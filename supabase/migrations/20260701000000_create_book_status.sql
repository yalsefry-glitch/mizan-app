-- supabase/migrations/20260701000000_create_book_status.sql
-- سجلّ حالة الكتب (Reconciliation): الحالة المرغوبة المقفلة + تغطية بالصفحات.
-- يطابق جدول book_status المُنشأ يدوياً. المفتاح: (subject_id, part_number) = كتاب فريد.

create table if not exists public.book_status (
  subject_id uuid not null,
  grade_id uuid,
  part_number int not null,
  book_slug text,
  total_lessons_detected int,
  detected_lessons jsonb,          -- الحالة المرغوبة المقفلة (لا تُعدّل بعد الإنشاء)
  lessons_written int,
  missing_lessons jsonb,
  coverage_complete boolean not null default false,
  reconcile_attempts int not null default 0,
  status text not null default 'processing',   -- processing | complete | needs_attention
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (subject_id, part_number)
);

-- RLS + قراءة عامّة (للوحة التحكّم والتطبيق).
alter table public.book_status enable row level security;

grant select on public.book_status to anon, authenticated;

drop policy if exists "book_status_select" on public.book_status;
create policy "book_status_select"
  on public.book_status
  for select
  using (true);
