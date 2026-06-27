// core/auth.ts
// منطق مصادقة وليّ الأمر: تسجيل، دخول، خروج، وجلب/تحديث ملفّه.
// يعتمد على Supabase Auth (بريد + كلمة مرور) + جدول parents.

import { supabase } from './supabase';
import type { Parent } from './supabase';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/**
 * تسجيل وليّ أمر جديد: ينشئ حساب مصادقة، ثمّ سجلّ في جدول parents.
 */
export async function signUpParent(
  email: string,
  password: string,
  fullName: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: translateError(error.message) };
  if (!data.user) return { ok: false, error: 'تعذّر إنشاء الحساب' };

  // إنشاء سجلّ وليّ الأمر المرتبط بحساب المصادقة.
  const { error: insErr } = await supabase.from('parents').insert({
    id: data.user.id,
    full_name: fullName,
    plan: 'free',
  });
  if (insErr) return { ok: false, error: 'تعذّر حفظ بيانات الحساب' };

  return { ok: true };
}

/**
 * دخول وليّ أمر موجود.
 */
export async function signInParent(
  email: string,
  password: string
): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: translateError(error.message) };
  return { ok: true };
}

/**
 * تسجيل الخروج.
 */
export async function signOutParent(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * جلب بيانات وليّ الأمر الحالي (من جدول parents).
 */
export async function getCurrentParent(): Promise<Parent | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error || !data) return null;
  return data as Parent;
}

/**
 * تعيين/تحديث الرقم السرّي (PIN) لبوّابة وليّ الأمر.
 */
export async function setParentPin(pin: string): Promise<AuthResult> {
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData.user;
  if (!user) return { ok: false, error: 'لا توجد جلسة' };

  const { error } = await supabase
    .from('parents')
    .update({ parent_pin: pin })
    .eq('id', user.id);
  if (error) return { ok: false, error: 'تعذّر حفظ الرقم السرّي' };
  return { ok: true };
}

/**
 * التحقّق من الرقم السرّي عند فتح بوّابة وليّ الأمر.
 */
export async function verifyParentPin(pin: string): Promise<boolean> {
  const parent = await getCurrentParent();
  return !!parent && parent.parent_pin === pin;
}

// ===== ترجمة رسائل أخطاء Supabase الشائعة للعربية =====
function translateError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists'))
    return 'هذا البريد مسجّل مسبقًا';
  if (m.includes('invalid login') || m.includes('invalid credentials'))
    return 'البريد أو كلمة المرور غير صحيحة';
  if (m.includes('password') && m.includes('6'))
    return 'كلمة المرور يجب أن تكون ٦ أحرف على الأقل';
  if (m.includes('email') && m.includes('valid'))
    return 'صيغة البريد غير صحيحة';
  return 'حدث خطأ، حاول مرّة أخرى';
}
