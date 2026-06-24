Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const dbKey = Deno.env.get("MIZAN_DB_KEY") ?? "";
  const openaiKey = Deno.env.get("OPENAI_KEY") ?? "";

  const dbHeaders: Record<string, string> = { apikey: dbKey, "Content-Type": "application/json" };
  if (dbKey.startsWith("eyJ")) dbHeaders.Authorization = `Bearer ${dbKey}`;

  const FREE_LIMIT = 20;
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

  // رسالة المستخدم
  let userMessage = "السلام عليكم";
  try {
    const body = await req.json();
    if (body?.message) userMessage = body.message;
  } catch (_) { /* الافتراضي */ }

  // 1) رمز المستخدم
  const authHeader = req.headers.get("Authorization") ?? "";
  const userToken = authHeader.replace("Bearer ", "").trim();
  if (!userToken) return json({ status: "لا رمز مستخدم" }, 401);

  // 2) التحقّق ومعرفة المستخدم
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: dbKey, Authorization: `Bearer ${userToken}` } });
  if (!userRes.ok) return json({ status: "رمز غير صالح", http_code: userRes.status }, 401);
  const user = JSON.parse(await userRes.text());
  const userId = user.id;

  // 3) قراءة الملفّ
  const profRes = await fetch(`${url}/rest/v1/profiles?select=plan,free_msg_count,is_admin,plan_expires_at&id=eq.${userId}`, { headers: dbHeaders });
  if (!profRes.ok) return json({ status: "فشل قراءة الملف", http_code: profRes.status, detail: await profRes.text() }, 500);
  const profile = JSON.parse(await profRes.text())[0] ?? null;
  if (!profile) return json({ status: "لا ملف لهذا المستخدم", user_id: userId }, 404);

  // 4) قرار الوصول
  const isAdmin = profile.is_admin === true;
  const now = new Date();
  const expires = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const subscriptionActive = (profile.plan === "basic" || profile.plan === "premium") && expires !== null && expires > now;
  const count = profile.free_msg_count ?? 0;

  // مجاني تجاوز الحدّ → طلب الاشتراك (لا ردّ، لا زيادة عدّاد)
  if (!isAdmin && !subscriptionActive && count >= FREE_LIMIT) {
    return json({ access: "subscribe_required", reason: "free_limit_reached", free_msg_count: count, limit: FREE_LIMIT });
  }

  // 5) قراءة دستور المنسّق + قائمة المساعدين
  const orchRes = await fetch(`${url}/rest/v1/assistants?select=system_instruction&id=eq.orchestrator`, { headers: dbHeaders });
  if (!orchRes.ok) return json({ status: "فشل قراءة المنسّق", http_code: orchRes.status, detail: await orchRes.text() }, 500);
  const dastur = JSON.parse(await orchRes.text())[0]?.system_instruction ?? "";

  const listRes = await fetch(`${url}/rest/v1/assistants?select=id,display_name,axis&id=neq.orchestrator&is_active=eq.true`, { headers: dbHeaders });
  if (!listRes.ok) return json({ status: "فشل قراءة القائمة", http_code: listRes.status, detail: await listRes.text() }, 500);
  const assistantsList = JSON.parse(await listRes.text());
  const validIds = assistantsList.map((a: { id: string }) => a.id);

  // 6) نداء OpenAI بالتوجيه
  const tools = [{
    type: "function",
    function: {
      name: "route_to_assistant",
      description: "وجّه المستخدم للمساعد المتخصّص الأنسب لسؤاله عند خروجه عن نطاق المنسّق العام.",
      parameters: {
        type: "object",
        properties: {
          assistant_id: { type: "string", enum: validIds, description: "معرّف المساعد المتخصّص الأنسب" },
          reason: { type: "string", description: "سبب التوجيه بإيجاز" },
        },
        required: ["assistant_id", "reason"],
      },
    },
  }];

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: dastur }, { role: "user", content: userMessage }],
      tools,
      tool_choice: "auto",
    }),
  });
  if (!aiRes.ok) return json({ status: "فشل نداء OpenAI", http_code: aiRes.status, detail: await aiRes.text() }, 500);
  const data = JSON.parse(await aiRes.text());
  const msg = data.choices[0].message;
  const toolCall = msg.tool_calls?.[0];

  // 7) زيادة عدّاد المجاني (بعد نجاح الردّ، للمجاني فقط)
  let newCount = count;
  if (!isAdmin && !subscriptionActive) {
    newCount = count + 1;
    await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: { ...dbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ free_msg_count: newCount }),
    });
  }

  // حالة الوصول للإظهار
  const access = isAdmin ? "full" : subscriptionActive ? "subscribed" : "free";
  const meta: Record<string, unknown> = { access, plan: profile.plan };
  if (access === "free") { meta.free_msg_count = newCount; meta.limit = FREE_LIMIT; meta.remaining = FREE_LIMIT - newCount; }

  // 8) الردّ: توجيه أو ردّ عام
  if (toolCall) {
    let args: { assistant_id?: string; reason?: string };
    try { args = JSON.parse(toolCall.function.arguments); }
    catch (_) { return json({ ...meta, mode: "fallback", note: "تعذّر فهم قرار التوجيه" }); }
    if (!args.assistant_id || !validIds.includes(args.assistant_id)) {
      return json({ ...meta, mode: "fallback", note: "وجهة غير صالحة", attempted: args.assistant_id ?? null });
    }
    const target = assistantsList.find((a: { id: string }) => a.id === args.assistant_id);
    return json({ ...meta, mode: "routed", routed_to: args.assistant_id, target_name: target?.display_name, target_axis: target?.axis, reason: args.reason });
  }

  return json({ ...meta, mode: "general", reply: msg.content });
});
