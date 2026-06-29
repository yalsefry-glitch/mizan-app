-- Migration: تعديل match_lesson_chunks لإرجاع page_number
-- حتى تستطيع rag-tutor تمرير رقم الصفحة للطفل.

-- حذف الدالة القديمة (return type تغيّر، CREATE OR REPLACE لا يكفي)
drop function if exists public.match_lesson_chunks(vector, uuid, int);

create or replace function public.match_lesson_chunks(
  query_embedding vector(768),
  p_lesson_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  chunk_index int,
  page_number int,
  similarity float
)
language sql
stable
as $$
  select
    lc.id,
    lc.content,
    lc.chunk_index,
    lc.page_number,
    1 - (lc.embedding <=> query_embedding) as similarity
  from public.lesson_chunks lc
  where lc.lesson_id = p_lesson_id           -- العزل التامّ: لا نخرج أبدًا خارج الدرس
  order by lc.embedding <=> query_embedding   -- ترتيب تصاعديّ بمسافة الكوزاين
  limit match_count;
$$;

-- تحديث GRANT (الدالة تغيّرت — نعيد المنح)
grant execute on function public.match_lesson_chunks(vector, uuid, int) to anon, authenticated;
