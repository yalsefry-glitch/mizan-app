Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const dbKey = Deno.env.get("MIZAN_DB_KEY") ?? "";

  const dbHeaders: Record<string, string> = { apikey: dbKey };
  if (dbKey.startsWith("eyJ")) dbHeaders.Authorization = `Bearer ${dbKey}`;

  // 1) قراءة رمز المستخدم من ترويسة الطلب
  const authHeader = req.headers.get("Authorization") ?? "";
  const userToken = authHeader.replace("Bearer ", "").trim();
  if (!userToken) {
    return new Response(JSON.stringify({ status: "لا رمز مستخدم", note: "أرسل Authorization: Bearer <user access token>" }, null, 2), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // 2) التحقّق من الرمز ومعرفة المستخدم (عبر نقطة /auth/v1/user)
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: dbKey, Authorization: `Bearer ${userToken}` },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ status: "رمز غير صالح", http_code: userRes.status, detail: await userRes.text() }, null, 2), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const user = JSON.parse(await userRes.text());
  const userId = user.id;

  // 3) قراءة ملفّ المستخدم من profiles
  const profRes = await fetch(`${url}/rest/v1/profiles?select=id,plan,free_msg_count,is_admin,plan_expires_at&id=eq.${userId}`, { headers: dbHeaders });
  if (!profRes.ok) {
    return new Response(JSON.stringify({ status: "فشل قراءة الملف", http_code: profRes.status, detail: await profRes.text() }, null, 2), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const profRows = JSON.parse(await profRes.text());
  const profile = profRows[0] ?? null;

  if (!profile) {
    return new Response(JSON.stringify({ status: "لا ملف لهذا المستخدم", user_id: userId, email: user.email }, null, 2), { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // 4) إرجاع هويّة المستخدم وملفّه (اختبار الطبقة 5أ)
  return new Response(JSON.stringify({
    message: "ميزان — قراءة المستخدم وملفّه تعمل",
    email: user.email,
    profile: {
      plan: profile.plan,
      free_msg_count: profile.free_msg_count,
      is_admin: profile.is_admin,
    },
  }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
});
