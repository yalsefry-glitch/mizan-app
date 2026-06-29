// supabase/functions/ingest-pdf/index.ts
// استيعاب درس في قاعدة RAG: يجلب النصّ (نصّ مُمرَّر مباشرة، أو استخراج من ملفّ PDF،
// أو من lessons.content_text)، يقسّمه إلى مقاطع متداخلة، يولّد embedding لكل مقطع
// عبر Gemini text-embedding-004 (٧٦٨ بُعدًا)، ويخزّنه في lesson_chunks.
// يُشغَّل بمفتاح الخدمة (service role) فيتجاوز RLS للكتابة.
//
// المفاتيح المطلوبة في الأسرار: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMBED_MODEL = 'text-embedding-004'; // ٧٦٨ بُعدًا — يطابق vector(768)
const CHUNK_SIZE = 900; // حروف لكل مقطع
const CHUNK_OVERLAP = 150; // تداخل بين المقاطع للحفاظ على ترابط السياق

// تقسيم النصّ إلى مقاطع متداخلة (نافذة منزلقة).
function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  const step = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);
  while (i < clean.length) {
    const piece = clean.slice(i, i + CHUNK_SIZE).trim();
    if (piece) chunks.push(piece);
    i += step;
  }
  return chunks;
}

// توليد embedding لنصّ واحد عبر Gemini.
async function embed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' +
      EMBED_MODEL +
      ':embedContent?key=' +
      apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/' + EMBED_MODEL,
        content: { parts: [{ text }] },
      }),
    }
  );
  if (!res.ok) throw new Error('فشل توليد embedding: ' + (await res.text()));
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error('ردّ embedding بلا قيم');
  return values;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const lessonId: string = body.lessonId || '';
    const subject: string = body.subject || '';
    const gradeOrder: number = Number(body.gradeOrder) || 0;
    const fileUrl: string = body.fileUrl || '';
    let text: string = body.text || '';

    if (!lessonId) return json({ error: 'lessonId مطلوب' }, 400);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // السرّ المضبوط في Supabase باسم SERVICE_ROLE_KEY (احتياط للاسم المحقون تلقائيًّا).
    const serviceKey =
      Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY غير مضبوط في الخادم' }, 500);
    if (!supabaseUrl || !serviceKey) return json({ error: 'إعداد Supabase ناقص في الخادم' }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    // مصدر النصّ: (أ) PDF صفحة صفحة + تتبّع الصفحات، (ب) نصّ مُمرَّر (بلا أرقام)، (ج) حقل الدرس.
    interface PagedChunk { text: string; pageNumber: number | null }
    const pagedChunks: PagedChunk[] = [];

    if (fileUrl) {
      // استخراج PDF صفحة صفحة مع تتبّع رقم الصفحة
      const { extractText, getDocumentProxy } = await import('https://esm.sh/unpdf');
      const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
      const pdf = await getDocumentProxy(buf);
      const totalPages = pdf.numPages;

      for (let p = 1; p <= totalPages; p++) {
        const pageResult = await extractText(pdf, { mergePages: false, pages: [p] });
        const pageText = Array.isArray(pageResult.text)
          ? pageResult.text.join('\n')
          : String(pageResult.text || '');
        if (pageText.trim()) {
          const pageChunks = chunkText(pageText);
          for (const chunk of pageChunks) {
            pagedChunks.push({ text: chunk, pageNumber: p });
          }
        }
      }
    } else if (text) {
      // نصّ مُمرَّر مباشرة — بلا أرقام صفحات
      const simpleChunks = chunkText(text);
      for (const chunk of simpleChunks) {
        pagedChunks.push({ text: chunk, pageNumber: null });
      }
    } else {
      // احتياط: جلب من حقل الدرس
      const { data: lesson } = await supabase
        .from('lessons')
        .select('content_text')
        .eq('id', lessonId)
        .single();
      const lessonText = lesson?.content_text || '';
      if (lessonText.trim()) {
        const simpleChunks = chunkText(lessonText);
        for (const chunk of simpleChunks) {
          pagedChunks.push({ text: chunk, pageNumber: null });
        }
      }
    }

    if (pagedChunks.length === 0) return json({ error: 'لا يوجد نصّ للاستيعاب' }, 400);

    // إعادة استيعاب نظيفة: نحذف مقاطع هذا الدرس السابقة قبل الإدراج.
    await supabase.from('lesson_chunks').delete().eq('lesson_id', lessonId);

    const rows: Record<string, unknown>[] = [];
    for (let idx = 0; idx < pagedChunks.length; idx++) {
      const { text: chunkText, pageNumber } = pagedChunks[idx];
      const embedding = await embed(chunkText, geminiKey);
      rows.push({
        lesson_id: lessonId,
        subject,
        grade_order: gradeOrder,
        chunk_index: idx,
        content: chunkText,
        page_number: pageNumber,
        embedding,
      });
    }

    const { error: insErr } = await supabase.from('lesson_chunks').insert(rows);
    if (insErr) return json({ error: 'فشل تخزين المقاطع', detail: insErr.message }, 500);

    return json({ ok: true, lessonId, chunks: rows.length });
  } catch (err: any) {
    return json({ error: String(err?.message || err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
