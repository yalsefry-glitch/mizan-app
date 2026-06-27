// core/children.ts
// إدارة ملفّات الأطفال تحت وليّ الأمر: جلب، إضافة، تحديث.
// كل طفل يحتفظ بصفّه ونقاطه ودقائق لعبه مستقلّة.

import { supabase } from './supabase';
import type { Child, Grade } from './supabase';

export interface ChildInput {
  name: string;
  avatar?: string;
  gradeId?: string;
}

/**
 * جلب كل أطفال وليّ الأمر الحالي.
 */
export async function getChildren(): Promise<Child[]> {
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData.user;
  if (!user) return [];

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as Child[];
}

/**
 * إضافة طفل جديد (حتّى ٤ أطفال أو أكثر تحت وليّ أمر واحد).
 */
export async function addChild(input: ChildInput): Promise<Child | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('children')
    .insert({
      parent_id: user.id,
      name: input.name,
      avatar: input.avatar ?? null,
      grade_id: input.gradeId ?? null,
    })
    .select()
    .single();
  if (error || !data) return null;
  return data as Child;
}

/**
 * تحديث صفّ الطفل (يؤثّر على التكيّف العمري).
 */
export async function updateChildGrade(
  childId: string,
  gradeId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('children')
    .update({ grade_id: gradeId })
    .eq('id', childId);
  return !error;
}

/**
 * حذف طفل.
 */
export async function removeChild(childId: string): Promise<boolean> {
  const { error } = await supabase.from('children').delete().eq('id', childId);
  return !error;
}

/**
 * جلب كل الصفوف (لاختيار صفّ الطفل عند الإضافة).
 */
export async function getGrades(): Promise<Grade[]> {
  const { data, error } = await supabase
    .from('grades')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data as Grade[];
}
