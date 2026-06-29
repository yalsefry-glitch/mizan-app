-- Migration: page tracking for lessons and chunks
-- تتبّع أرقام الصفحات في الدروس والمقاطع لربط المحتوى برقم الصفحة الحقيقي من الكتاب.

-- إضافة نطاق الصفحات لكل درس (الصفحة الأولى والأخيرة)
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS page_start INTEGER,
  ADD COLUMN IF NOT EXISTS page_end INTEGER;

COMMENT ON COLUMN lessons.page_start IS 'رقم الصفحة الأولى للدرس في الكتاب';
COMMENT ON COLUMN lessons.page_end IS 'رقم الصفحة الأخيرة للدرس في الكتاب';

-- إضافة رقم الصفحة لكل مقطع (chunk) من المنهج
ALTER TABLE lesson_chunks
  ADD COLUMN IF NOT EXISTS page_number INTEGER;

COMMENT ON COLUMN lesson_chunks.page_number IS 'رقم الصفحة التي استُخرج منها المقطع';

-- فهرس لتسريع الاستعلام عن المقاطع حسب الصفحة
CREATE INDEX IF NOT EXISTS idx_lesson_chunks_page_number
  ON lesson_chunks(page_number);
