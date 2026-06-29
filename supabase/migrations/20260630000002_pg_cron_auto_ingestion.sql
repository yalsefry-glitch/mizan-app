-- Migration: pg_cron للاستمرار التلقائي لاستيعاب الكتب
-- يستدعي ingest-batch كل دقيقة لإكمال المهامّ المعلّقة

-- تفعيل pg_cron (إن لم يكن مفعّلاً)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- حذف المهمّة السابقة إن وُجدت
SELECT cron.unschedule('auto-ingest-batch');

-- جدولة مهمّة كل دقيقة
SELECT cron.schedule(
  'auto-ingest-batch',
  '* * * * *', -- كل دقيقة
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/ingest-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object()
  )
  $$
);

COMMENT ON EXTENSION pg_cron IS 'جدولة مهامّ دورية في PostgreSQL';
