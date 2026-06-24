Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const dbKey = Deno.env.get("MIZAN_DB_KEY") ?? "";

  const dbHeaders: Record<string, string> = { apikey: dbKey };
  if (dbKey.startsWith("eyJ")) dbHeaders.Authorization = `Bearer ${dbKey}`;

  const FREE_LIMIT = 20;

  // 1) رمز المستخدم
  const authHeader = req.headers.get("Authorization") ?? "";
  const userToken = authHeader.replace("Bearer ", "").trim();
  if (!userToken) {
    return new Response(JSON.stringify({ status: "لا رمز مستخدم" }, null, 2), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // 2) التحقّق ومعرفة المستخدم
  const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: dbKey, Authorization: `Bearer ${userToken}` } });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ status: "رمز غير صالح", http_code: userRes.status }, null, 2), { status: 401, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const user = JSON.parse(await userRes.text());
  const userId = user.id;

  // 3) قراءة الملفّ
  const profRes = await fetch(`${url}/rest/v1/profiles?select=plan,free_msg_count,is_admin,plan_expires_at&id=eq.${userId}`, { headers: dbHeaders });
  if (!profRes.ok) {
    return new Response(JSON.stringify({ status: "فشل قراءة الملف", http_code: profRes.status, detail: await profRes.text() }, null, 2), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
  const profile = JSON.parse(await profRes.text())[0] ?? null;
  if (!profile) {
    return new Response(JSON.stringify({ status: "لا ملف لهذا المستخدم", user_id: userId }, null, 2), { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // 4) قرار الوصول
  // أدمن: وصول كامل بلا قيود
  if (profile.is_admin === true) {
    return new Response(JSON.stringify({ access: "full", reason: "admin", email: user.email, plan: profile.plan }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // هل الاشتراك ساري؟ (basic/premium مع تاريخ غير منتهٍ)
  const now = new Date();
  const expires = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const subscriptionActive =
    (profile.plan === "basic" || profile.plan === "premium") &&
    expires !== null && expires > now;

  // مشترك ساري: وصول حسب الباقة
  if (subscriptionActive) {
    return new Response(JSON.stringify({ access: "subscribed", plan: profile.plan, expires_at: profile.plan_expires_at, email: user.email }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // غير مشترك (free، أو باقة منتهية): يخضع لعدّاد المجاني
  const count = profile.free_msg_count ?? 0;
  if (count >= FREE_LIMIT) {
    return new Response(JSON.stringify({ access: "subscribe_required", reason: "free_limit_reached", free_msg_count: count, limit: FREE_LIMIT, email: user.email }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  }

  // ضمن الحدّ المجاني: المنسّق فقط
  return new Response(JSON.stringify({ access: "free", scope: "orchestrator_only", free_msg_count: count, limit: FREE_LIMIT, remaining: FREE_LIMIT - count, email: user.email }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
});
