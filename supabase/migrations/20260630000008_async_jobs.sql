-- Async job tracking for PDF worker (beats Render 100s load balancer limit)
-- Jobs are created immediately when /process-book receives a request,
-- then processed asynchronously while the client polls /job/:id for status.

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_slug TEXT NOT NULL,
  subject_id UUID,
  grade_id UUID,
  part_number INTEGER,

  -- Job status: queued → converting → detecting → processing → done/failed
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'converting', 'detecting', 'processing', 'done', 'failed')),

  -- Progress tracking
  total_pages INTEGER DEFAULT 0,
  pages_uploaded INTEGER DEFAULT 0,
  chapters_total INTEGER DEFAULT 0,
  chapters_done INTEGER DEFAULT 0,
  current_step TEXT, -- Human-readable current operation (e.g., "Converting pages 6-10...")

  -- Error tracking
  error TEXT,

  -- Final result (JSON with chapters array, gaps, failed_chapters)
  result JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for listing recent jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_created_at ON public.ingestion_jobs (created_at DESC);

-- Index for polling by ID
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_id ON public.ingestion_jobs (id);

-- RLS: Service role has full access (pdf-worker uses service_role_key)
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to ingestion_jobs" ON public.ingestion_jobs;
CREATE POLICY "Service role full access to ingestion_jobs"
  ON public.ingestion_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.ingestion_jobs TO service_role;
GRANT SELECT ON public.ingestion_jobs TO authenticated; -- Admin panel can view jobs
