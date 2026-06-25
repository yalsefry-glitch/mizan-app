// =====================================================================
// ميزان — rapid-function (نسخة البحث الحيّ المحصّن + ضبط الحرارة المتدرّجة)
// المنسّق: توجيه فقط، بلا بحث. المتخصّصون: أداة web_search واحدة عبر Tavily.
// القيود الصلبة: حصر النطاقات الرسمية + تجريد الاستعلام + السقوط الآمن.
// [حرارة] المساعدون الحرجة/الحسّاسة 0.2 | الباقي 0.4 | المنسّق افتراضي.
// =====================================================================

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const dbKey = Deno.env.get("MIZAN_DB_KEY") ?? "";
  const openaiKey = Deno.env.get("OPENAI_KEY") ?? "";
  const tavilyKey = Deno.env.get("TAVILY_KEY") ?? "";

  const dbHeaders: Record<string, string> = { apikey: dbKey, "Content-Type": "application/json" };
  if (dbKey.startsWith("eyJ")) dbHeaders.Authorization = `Bearer ${dbKey}`;

  // إعدادات حدّ المعدّل (قابلة للتعديل):
  const RL_MAX_PER_WINDOW = 20;   // أقصى عدد طلبات في النافذة
  const RL_WINDOW_MS = 60000;     // طول النافذة: دقيقة واحدة
  const RL_COOLDOWN_MS = 1500;    // أدنى فاصل بين طلبين: 1.5 ثانية

  // ---------------------------------------------------------------
  // [حرارة] ضبط الحرارة المتدرّجة لتقليل العشوائية/الهلوسة.
  // الحرجة (الحماية الأسرية، الطوارئ) والحسّاسة (الطلاق، الابتزاز): 0.2
  // الباقي من المتخصّصين: 0.4 (يبقي اللهجة طبيعية بلا هلوسة).
  // المنسّق: لا نحدّد حرارة (افتراضي) — أداة توجيه لا يكتب محتوى.
  // ---------------------------------------------------------------
  const LOW_TEMP_IDS = [
    "family_protection",     // حرج
    "emergency_firstaid",    // حرج
    "family_divorce",        // حسّاس
    "electronic_extortion",  // حسّاس
  ];
  const tempFor = (id: string): number => (LOW_TEMP_IDS.includes(id) ? 0.2 : 0.4);

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });

  // ---------------------------------------------------------------
  // القيد الصلب (١): حصر نطاقات البحث في المصادر الرسمية السعودية فقط.
  // يُمرَّر إلى Tavily كـ include_domains، فلا يصل النموذج أي مصدر خارجها.
  // ---------------------------------------------------------------
  const OFFICIAL_DOMAINS = [
    "gov.sa",
    "my.gov.sa",
    "najiz.sa",
    "moj.gov.sa",
    "qiwa.sa",
    "mudad.com.sa",
    "absher.sa",
    "musaned.com.sa",
    "gosi.gov.sa",
    "sama.gov.sa",
    "taradhi.sa",
    "hrsd.gov.sa",
    "mc.gov.sa",
    "monshaat.gov.sa",
    "zatca.gov.sa",
    "saned.gosi.gov.sa",
    "scfhs.org.sa",
    "saudieng.sa",
    "socpa.org.sa",
  ];

  // ---------------------------------------------------------------
  // القيد الصلب (٢): تجريد الاستعلام (Query Stripping).
  // يزيل الأنماط الحسّاسة قبل إرسال أي استعلام إلى Tavily:
  // أرقام الهوية/الحسابات الطويلة، الآيبان، البريد، الهواتف، رموز OTP،
  // والأرقام المتوسّطة (مبالغ/تواريخ رقمية). الهدف: ألّا تغادر بيانات
  // المستخدم الخادمَ إلى محرّك البحث إطلاقاً.
  // ---------------------------------------------------------------
  const stripQuery = (q: string): string => {
    let s = q ?? "";
    s = s.replace(/\bSA\d{2}[0-9A-Z]{18,}\b/gi, " "); // IBAN سعودي
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " "); // بريد إلكتروني
    s = s.replace(/https?:\/\/\S+/g, " "); // روابط
    s = s.replace(/\d[\d\s\-]{4,}\d/g, " "); // أي تسلسل رقمي طوله 6+ (هوية/حساب/هاتف/صكّ)
    s = s.replace(/[#@]/g, " "); // رموز قد تسبق معرّفات
    s = s.replace(/\s{2,}/g, " ").trim(); // تنظيف الفراغات
    return s.slice(0, 300); // سقف طول الاستعلام
  };

  // ---------------------------------------------------------------
  // أداة البحث عبر Tavily (محصورة في النطاقات الرسمية).
  // تُعيد نصّاً موجزاً للنموذج، أو علامة فشل صريحة للسقوط الآمن.
  // ---------------------------------------------------------------
  const runTavily = async (rawQuery: string): Promise<{ ok: boolean; text: string }> => {
    if (!tavilyKey) return { ok: false, text: "SEARCH_UNAVAILABLE" };
    const cleanQuery = stripQuery(rawQuery);
    if (!cleanQuery) return { ok: false, text: "SEARCH_EMPTY_QUERY" };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000); // مهلة 12 ثانية
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
        signal: ctrl.signal,
        body: JSON.stringify({
          query: cleanQuery,
          search_depth: "advanced",
          include_domains: OFFICIAL_DOMAINS, // القيد الصلب يُفرض هنا
          max_results: 5,
          include_answer: true,
        }),
      });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, text: "SEARCH_FAILED" };
      const data = JSON.parse(await res.text());
      const parts: string[] = [];
      if (data.answer) parts.push(`Summary: ${data.answer}`);
      const results = Array.isArray(data.results) ? data.results : [];
      for (const r of results) {
        if (r?.title && r?.content) {
          parts.push(`- ${r.title} (${r.url ?? ""}): ${String(r.content).slice(0, 500)}`);
        }
      }
      if (parts.length === 0) return { ok: false, text: "SEARCH_NO_RESULTS" };
      return { ok: true, text: parts.join("\n") };
    } catch (_) {
      return { ok: false, text: "SEARCH_FAILED" }; // تجاهل المهلة/الشبكة بأمان
    }
  };

  // قراءة جسم الطلب
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
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: dbKey, Authorization: `Bearer ${userToken}` },
  });
  if (!userRes.ok) return json({ status: "رمز غير صالح", http_code: userRes.status }, 401);
  const user = JSON.parse(await userRes.text());
  const userId = user.id;

  // 3) قراءة الملفّ (مع عدّاد المحادثات)
  const profRes = await fetch(
    `${url}/rest/v1/profiles?select=plan,is_admin,conversations_used,conversations_limit,full_name&id=eq.${userId}`, // [اسم] أضفنا full_name
    { headers: dbHeaders },
  );
  if (!profRes.ok) return json({ status: "فشل قراءة الملف", http_code: profRes.status, detail: await profRes.text() }, 500);
  const profile = JSON.parse(await profRes.text())[0] ?? null;
  if (!profile) return json({ status: "لا ملف لهذا المستخدم", user_id: userId }, 404);

  const isAdmin = profile.is_admin === true;
  const used = profile.conversations_used ?? 0;

  // الحدّ يُقرأ حيّاً من جدول plans حسب باقة المستخدم.
  // تغيير msg_limit في plans يسري على الجميع فوراً بلا تحديث تطبيق.
  // ترتيب الأولوية: حدّ الباقة من plans ← العمود في profiles ← احتياطي 10.
  let limit = profile.conversations_limit ?? 10;
  {
    const planId = profile.plan ?? "free";
    const planRes = await fetch(
      `${url}/rest/v1/plans?select=msg_limit&id=eq.${planId}`,
      { headers: dbHeaders },
    );
    if (planRes.ok) {
      const planRow = JSON.parse(await planRes.text())[0] ?? null;
      if (planRow && typeof planRow.msg_limit === "number") limit = planRow.msg_limit;
    }
  }

  // 4) قراءة الجلسة الحالية
  const sessRes = await fetch(
    `${url}/rest/v1/sessions?select=active_assistant&user_id=eq.${userId}&order=last_activity_at.desc&limit=1`,
    { headers: dbHeaders },
  );
  const sessRows = sessRes.ok ? JSON.parse(await sessRes.text()) : [];
  const prevAssistant = sessRows[0]?.active_assistant ?? null;
  const isNewConversation = prevAssistant !== assistantId;

  // 5) قرار الوصول (للمستخدم العادي فقط؛ المدير بلا حدّ)
  if (!isAdmin && isNewConversation && used >= limit) {
    return json({
      access: "subscribe_required",
      reason: "conversations_limit_reached",
      conversations_used: used,
      conversations_limit: limit,
    });
  }

  // 5.5) حدّ المعدّل (للمستخدم العادي فقط؛ المدير معفى تماماً).
  // يقع قبل أي نداء مكلف (OpenAI/Tavily) فالطلب المرفوض لا يستهلك رصيداً.
  // النداء ذرّي عبر دالّة PostgreSQL check_rate_limit (تقفل الصفّ FOR UPDATE)
  // فتمتنع الطلبات المتوازية من التسلّل معاً.
  if (!isAdmin) {
    const rlRes = await fetch(`${url}/rest/v1/rpc/check_rate_limit`, {
      method: "POST",
      headers: dbHeaders,
      body: JSON.stringify({
        p_user_id: userId,
        p_window_ms: RL_WINDOW_MS,
        p_cooldown_ms: RL_COOLDOWN_MS,
        p_max_req: RL_MAX_PER_WINDOW,
      }),
    });

    // النتيجة نصّ: "allowed" أو "too_fast" أو "too_many".
    const rlVerdict = rlRes.ok ? JSON.parse(await rlRes.text()) : "allowed";

    if (rlVerdict === "too_fast") {
      return json({
        access: "rate_limited",
        reason: "too_fast",
        message: "أرسلت الطلبات بسرعة كبيرة. انتظر لحظةً ثم حاول مرة أخرى.",
      }, 429);
    }
    if (rlVerdict === "too_many") {
      return json({
        access: "rate_limited",
        reason: "too_many_requests",
        message: "أرسلت عدداً كبيراً من الأسئلة خلال وقت قصير. انتظر دقيقةً ثم حاول مرة أخرى.",
      }, 429);
    }
    // "allowed" أو فشل النداء (نسمح بدل حجب المستخدم خطأً) → نكمل.
  }

  // 6) قراءة دستور المساعد المطلوب
  const asstRes = await fetch(
    `${url}/rest/v1/assistants?select=id,display_name,axis,system_instruction&id=eq.${assistantId}&is_active=eq.true`,
    { headers: dbHeaders },
  );
  if (!asstRes.ok) return json({ status: "فشل قراءة المساعد", http_code: asstRes.status, detail: await asstRes.text() }, 500);
  const assistant = JSON.parse(await asstRes.text())[0] ?? null;
  if (!assistant) return json({ status: "المساعد غير موجود", attempted: assistantId }, 404);

  // [اسم] استخراج الاسم الأول من full_name (قد يكون فارغاً) واستبدال {{USER_NAME}}.
  // إن كان فارغاً نضع نصّاً فارغاً، والقالب يتعامل مع ذلك بترحيب بلا اسم.
  const firstName = String(profile.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  const dastur = (assistant.system_instruction ?? "").split("{{USER_NAME}}").join(firstName);
  const isOrchestrator = assistantId === "orchestrator";

  // [سور] تعليمة وسم النطاق — للمتخصّص فقط. تُلزم النموذج ببدء ردّه بوسم خفيّ
  // يلتقطه الكود: IN_SCOPE إن كان السؤال ضمن نطاق المساعد، OUT_OF_SCOPE إن كان خارجه.
  // الكود يجرّد الوسم قبل عرض الردّ، ويستبدل الردّ برسالة رفض عند OUT_OF_SCOPE.
  const scopeGuard = isOrchestrator ? "" :
    "\n\n[INTERNAL SCOPE TAG — MANDATORY] Before anything else, decide if the user's message " +
    "is within THIS assistant's domain (as defined above). Begin your reply with EXACTLY one tag " +
    "on its own first line: write IN_SCOPE if it is within your domain, or OUT_OF_SCOPE if it is " +
    "outside your domain (another Mizan topic, or general/non-Mizan knowledge). This tag is internal " +
    "and will be removed before the user sees it. After the tag, continue normally per your rules.";

  // 7) إعداد نداء OpenAI
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: dastur + scopeGuard },
    { role: "user", content: userMessage },
  ];
  const payload: Record<string, unknown> = { model: "gpt-4o-mini", messages };
  // [حرارة] المتخصّص يأخذ حرارة محدّدة؛ المنسّق يبقى افتراضيّاً (توجيه فقط).
  if (!isOrchestrator) payload.temperature = tempFor(assistantId);

  // قائمة المساعدين (للمنسّق فقط، للتوجيه)
  let assistantsList: Array<{ id: string; display_name: string; axis: string }> = [];

  if (isOrchestrator) {
    // المنسّق: أداة توجيه فقط، لا بحث.
    const listRes = await fetch(
      `${url}/rest/v1/assistants?select=id,display_name,axis&id=neq.orchestrator&is_active=eq.true`,
      { headers: dbHeaders },
    );
    assistantsList = listRes.ok ? JSON.parse(await listRes.text()) : [];
    const validIds = assistantsList.map((a) => a.id);
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
  } else {
    // المتخصّص: أداة بحث واحدة فقط (web_search).
    payload.tools = [{
      type: "function",
      function: {
        name: "web_search",
        description: "ابحث عن معلومة رسمية محدّثة (رسم/مهلة/رقم/رابط/خطوة) من المصادر الرسمية السعودية فقط. صُغ الاستعلام مجرّداً وعامّاً بلا أي بيانات للمستخدم.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "استعلام مجرّد إجرائي عامّ بالعربية، بلا أسماء أو أرقام أو تفاصيل خاصّة" },
          },
          required: ["query"],
        },
      },
    }];
    payload.tool_choice = "auto";
  }

  // ---------------------------------------------------------------
  // النداء الأول لـ OpenAI
  // ---------------------------------------------------------------
  const callOpenAI = async (body: Record<string, unknown>) => {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) return { ok: false, detail: await r.text(), data: null as unknown };
    return { ok: true, detail: "", data: JSON.parse(await r.text()) };
  };

  // [سور] يفحص وسم النطاق في بداية ردّ المتخصّص، يجرّده، ويقرّر إن كان خارج النطاق.
  const OUT_OF_SCOPE_REPLY =
    "هذا السؤال خارج نطاق هذا المساعد في «ميزان». ميزان يقدّم إرشاداً نظاميّاً وإجرائيّاً سعوديّاً " +
    "ضمن محاوره فقط. لو احتجت، ارجع إلى «ميزان العام» ليوجّهك للمساعد المناسب لسؤالك.\n\n" +
    "«ميزان مساعد استرشادي للتوعية، والمعلومات قابلة للتغيير، ويُنصح بالرجوع إلى الجهة الرسمية المعنيّة قبل الإجراء.»";

  const applyScopeGuard = (text: string): { outOfScope: boolean; clean: string } => {
    const t = String(text ?? "").trimStart();
    if (/^OUT_OF_SCOPE\b/i.test(t)) return { outOfScope: true, clean: OUT_OF_SCOPE_REPLY };
    // نجرّد وسم IN_SCOPE (وأي OUT_OF_SCOPE احتياطاً) من بداية الردّ الظاهر
    const clean = t.replace(/^(IN_SCOPE|OUT_OF_SCOPE)\b[:\-\s]*/i, "").trimStart();
    return { outOfScope: false, clean };
  };

  const first = await callOpenAI(payload);
  if (!first.ok) return json({ status: "فشل نداء OpenAI", detail: first.detail }, 500);
  // deno-lint-ignore no-explicit-any
  const msg = (first.data as any).choices[0].message;
  const toolCall = msg.tool_calls?.[0];

  // 8) تحديث الجلسة + عدّاد المحادثات (محادثة جديدة فقط، للعادي فقط)
  let newUsed = used;
  if (isNewConversation) {
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

  const access = isAdmin ? "full" : profile.plan;
  const meta: Record<string, unknown> = { access, assistant_id: assistantId, assistant_name: assistant.display_name };
  if (!isAdmin) { meta.conversations_used = newUsed; meta.conversations_limit = limit; meta.new_conversation = isNewConversation; }

  // ---------------------------------------------------------------
  // المنسّق: تنفيذ التوجيه
  // ---------------------------------------------------------------
  if (isOrchestrator) {
    if (toolCall && toolCall.function?.name === "route_to_assistant") {
      let args: { assistant_id?: string; reason?: string };
      try { args = JSON.parse(toolCall.function.arguments); }
      catch (_) { return json({ ...meta, mode: "fallback", note: "تعذّر فهم التوجيه" }); }
      const target = assistantsList.find((a) => a.id === args.assistant_id);
      if (!target) return json({ ...meta, mode: "fallback", note: "وجهة غير صالحة", attempted: args.assistant_id ?? null });
      return json({ ...meta, mode: "routed", routed_to: args.assistant_id, target_name: target.display_name, target_axis: target.axis, reason: args.reason });
    }
    return json({ ...meta, mode: "general", reply: msg.content });
  }

  // ---------------------------------------------------------------
  // المتخصّص: إن لم يطلب بحثاً → ردّ مباشر
  // ---------------------------------------------------------------
  if (!toolCall || toolCall.function?.name !== "web_search") {
    const g = applyScopeGuard(msg.content); // [سور]
    return json({ ...meta, mode: g.outOfScope ? "out_of_scope" : "direct", reply: g.clean });
  }

  // ---------------------------------------------------------------
  // المتخصّص طلب بحثاً → نفّذ Tavily ثم أعد النتيجة للنموذج (الحلقة)
  // ---------------------------------------------------------------
  let searchQuery = "";
  try { searchQuery = JSON.parse(toolCall.function.arguments)?.query ?? ""; } catch (_) { searchQuery = ""; }

  const search = await runTavily(searchQuery);

  // القيد الصلب (٣): السقوط الآمن — نُبلّغ النموذج صراحةً بفشل/نجاح البحث.
  const toolResultContent = search.ok
    ? `SEARCH_RESULTS (official Saudi sources only):\n${search.text}`
    : `SEARCH_FAILED: The live search did not return usable official information (${search.text}). Per your instructions, tell the user plainly that you could not retrieve the live updated information at this moment, and direct them to the official source/platform to confirm. Do not invent any fee, period, number, procedure, or link.`;

  // أضف رسالة النموذج (طلب الأداة) ثم نتيجة الأداة
  messages.push(msg);
  messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResultContent });

  // النداء الثاني: النموذج يكتب الجواب النهائي (بلا أدوات هذه المرّة)
  // [حرارة] نفس حرارة المتخصّص في النداء الثاني للاتّساق.
  const second = await callOpenAI({ model: "gpt-4o-mini", messages, temperature: tempFor(assistantId) });
  if (!second.ok) return json({ status: "فشل نداء OpenAI الثاني", detail: second.detail }, 500);
  // deno-lint-ignore no-explicit-any
  const finalMsg = (second.data as any).choices[0].message;

  const gs = applyScopeGuard(finalMsg.content); // [سور]
  return json({
    ...meta,
    mode: gs.outOfScope ? "out_of_scope" : "direct_searched",
    search_ok: search.ok,
    reply: gs.clean,
  });
});
