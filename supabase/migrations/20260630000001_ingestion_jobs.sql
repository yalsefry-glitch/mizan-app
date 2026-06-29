-- Migration: جدول مهامّ الاستيعاب بالدفعات
-- يدير استيعاب الكتب الكاملة بالخلفية دون حدود زمنية

-- جدول المهامّ
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
  part_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  total_pages INT,
  last_page_done INT NOT NULL DEFAULT 0,
  lessons_created INT NOT NULL DEFAULT 0,
  chunks_created INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهرس للبحث السريع عن المهامّ المعلّقة
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON public.ingestion_jobs(status);

-- صلاحيات
GRANT SELECT, INSERT, UPDATE ON public.ingestion_jobs TO authenticated;
GRANT ALL ON public.ingestion_jobs TO service_role;

-- سياسة RLS: المستخدمون المصادَق عليهم يمكنهم القراءة والإدراج
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingestion_jobs_select" ON public.ingestion_jobs;
CREATE POLICY "ingestion_jobs_select" ON public.ingestion_jobs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ingestion_jobs_insert" ON public.ingestion_jobs;
CREATE POLICY "ingestion_jobs_insert" ON public.ingestion_jobs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ingestion_jobs_update" ON public.ingestion_jobs;
CREATE POLICY "ingestion_jobs_update" ON public.ingestion_jobs
  FOR UPDATE USING (true);

-- تعليقات توضيحية
COMMENT ON TABLE public.ingestion_jobs IS 'مهامّ استيعاب الكتب بالدفعات';
COMMENT ON COLUMN public.ingestion_jobs.file_path IS 'مسار الكتاب في Storage (مثل: books/math-grade1-part1.pdf)';
COMMENT ON COLUMN public.ingestion_jobs.status IS 'حالة المهمّة: pending (معلّق) | processing (يُعالَج) | done (تمّ) | failed (فشل)';
COMMENT ON COLUMN public.ingestion_jobs.total_pages IS 'إجمالي عدد صفحات الكتاب';
COMMENT ON COLUMN public.ingestion_jobs.last_page_done IS 'آخر صفحة تمّت معالجتها';
COMMENT ON COLUMN public.ingestion_jobs.lessons_created IS 'عدد الدروس المُنشأة';
COMMENT ON COLUMN public.ingestion_jobs.chunks_created IS 'عدد المقاطع المُنشأة';
