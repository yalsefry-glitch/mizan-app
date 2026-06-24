Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const dbKey = Deno.env.get("MIZAN_DB_KEY") ?? "";
  const openaiKey = Deno.env.get("OPENAI_KEY") ?? "";

  const dbHeaders: Record<string, string> = { apikey: dbKey, "Content-Type": "application/json" };
  if (dbKey.startsWith("eyJ")) dbHeaders.Authorization = `Bearer ${dbKey}`;

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

  // قراءة جسم الطلب: الرسالة + المساعد المطلوب
  let userMessage = "السلام عليكم";
  let assistantId = "orchestrator";
  try {
    const body = await req.json();
    if (body?.message) userMessage = body.message;
    if (body?.assistant_id) assistantId = body.assistant_id;
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

  // 3) قراءة الملفّ (مع عدّاد المحادثات)
  const profRes = await fetch(`${url}/rest/v1/profiles?select=plan,is_admin,conversations_used,conversations_limit&id=eq.${userId}`, { headers: dbHeaders });
  if (!profRes.ok) return json({ status: "فشل قراءة الملف", http_code: profRes.status, detail: await profRes.text() }, 500);
  const profile = JSON.parse(await profRes.text())[0] ?? null;
  if (!profile) return json({ status: "لا ملف لهذا المستخدم", user_id: userId }, 404);

  const isAdmin = profile.is_admin === true;
  const used = profile.conversations_used ?? 0;
  const limit = profile.conversations_limit ?? 3;

  // 4) قراءة الجلسة الحالية: أي مساعد كان نشطاً؟
  const sessRes = await fetch(`${url}/rest/v1/sessions?select=active_assistant&user_id=eq.${userId}&order=last_activity_at.desc&limit=1`, { headers: dbHeaders });
  const sessRows = sessRes.ok ? JSON.parse(await sessRes.text()) : [];
  const prevAssistant = sessRows[0]?.active_assistant ?? null;

  // محادثة جديدة = مساعد مختلف عن الجلسة السابقة (أو لا جلسة)
  const isNewConversation = prevAssistant !== assistantId;

  // 5) قرار الوصول (للمستخدم العادي فقط؛ المدير بلا حدّ)
  if (!isAdmin && isNewConversation && used >= limit) {
    return json({ access: "subscribe_required", reason: "conversations_limit_reached", conversations_used: used, conversations_limit: limit });
  }

  // 6) قراءة دستور المساعد المطلوب (المنسّق أو المتخصّص)
  const asstRes = await fetch(`${url}/rest/v1/assistants?select=id,display_name,axis,system_instruction&id=eq.${assistantId}&is_active=eq.true`, { headers: dbHeaders });
  if (!asstRes.ok) return json({ status: "فشل قراءة المساعد", http_code: asstRes.status, detail: await asstRes.text() }, 500);
  const assistant = JSON.parse(await asstRes.text())[0] ?? null;
  if (!assistant) return json({ status: "المساعد غير موجود", attempted: assistantId }, 404);

  const dastur = assistant.system_instruction ?? "";
  const isOrchestrator = assistantId === "orchestrator";

  // 7) إعداد نداء OpenAI
  // وضع المنسّق: يوجّه عبر أداة. وضع المتخصّص: يردّ مباشرةً بلا توجيه.
  const payload: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: dastur }, { role: "user", content: userMessage }],
  };

  if (isOrchestrator) {
    // المنسّق يحتاج قائمة الوجهات للتوجيه
    const listRes = await fetch(`${url}/rest/v1/assistants?select=id,display_name,axis&id=neq.orchestrator&is_active=eq.true`, { headers: dbHeaders });
    const assistantsList = listRes.ok ? JSON.parse(await listRes.text()) : [];
    const validIds = assistantsList.map((a: { id: string }) => a.id);
    payload.tools = [{
      type: "function",
      function: {
        name: "route_to_assistant",
        description: "وجّه المستخدم للمساعد المتخصّص الأنسب لسؤاله.",
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
    payload.tool_choice = "auto";
    payload._list = assistantsList;
  }

  const assistantsList = (payload._list as Array<{ id: string; display_name: string; axis: string }>) ?? [];
  delete payload._list;

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify(payload),
  });
  if (!aiRes.ok) return json({ status: "فشل نداء OpenAI", http_code: aiRes.status, detail: await aiRes.text() }, 500);
  const data = JSON.parse(await aiRes.text());
  const msg = data.choices[0].message;
  const toolCall = msg.tool_calls?.[0];

  // 8) تحديث الجلسة + عدّاد المحادثات (محادثة جديدة فقط، للعادي فقط)
  let newUsed = used;
  if (isNewConversation) {
    // حدّث الجلسة بالمساعد النشط الجديد
    await fetch(`${url}/rest/v1/sessions`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, active_assistant: assistantId, last_activity_at: new Date().toISOString() }),
    });
    if (!isAdmin) {
      newUsed = used + 1;
      await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { ...dbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({ conversations_used: newUsed }),
      });
    }
  }

  // 9) الردّ
  const access = isAdmin ? "full" : profile.plan;
  const meta: Record<string, unknown> = { access, assistant_id: assistantId, assistant_name: assistant.display_name };
  if (!isAdmin) { meta.conversations_used = newUsed; meta.conversations_limit = limit; meta.new_conversation = isNewConversation; }

  if (isOrchestrator && toolCall) {
    let args: { assistant_id?: string; reason?: string };
    try { args = JSON.parse(toolCall.function.arguments); }
    catch (_) { return json({ ...meta, mode: "fallback", note: "تعذّر فهم التوجيه" }); }
    const target = assistantsList.find((a) => a.id === args.assistant_id);
    if (!target) return json({ ...meta, mode: "fallback", note: "وجهة غير صالحة", attempted: args.assistant_id ?? null });
    return json({ ...meta, mode: "routed", routed_to: args.assistant_id, target_name: target.display_name, target_axis: target.axis, reason: args.reason });
  }

  return json({ ...meta, mode: isOrchestrator ? "general" : "direct", reply: msg.content });
});
