// supabase/functions/ingest-batch/index.ts
// معالجة دفعة صغيرة (~12 صفحة) من كتاب لتجاوز حدّ ١٥٠ث.
// يُستدعى مراراً حتى ينتهي الكتاب.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMBED_MODEL = 'text-embedding-004';
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const GEMINI_MODEL = 'gemini-2.0-flash-exp';
const BATCH_SIZE = 12; // صفحات لكل دفعة

// ===== مساعدات =====
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

async function embed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
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

interface PageText {
  pageNumber: number;
  text: string;
}

async function extractPdfPages(fileUrl: string, startPage: number, endPage: number): Promise<PageText[]> {
  const { extractText, getDocumentProxy } = await import('https://esm.sh/unpdf');
  const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
  const pdf = await getDocumentProxy(buf);
  const pages: PageText[] = [];

  for (let p = startPage; p <= Math.min(endPage, pdf.numPages); p++) {
    const pageResult = await extractText(pdf, { mergePages: false, pages: [p] });
    const pageText = Array.isArray(pageResult.text)
      ? pageResult.text.join('\n')
      : String(pageResult.text || '');
    pages.push({ pageNumber: p, text: pageText });
  }
  return pages;
}

async function extractAllPagesForStructure(fileUrl: string): Promise<{ pages: PageText[]; totalPages: number }> {
  const { extractText, getDocumentProxy } = await import('https://esm.sh/unpdf');
  const buf = new Uint8Array(await (await fetch(fileUrl)).arrayBuffer());
  const pdf = await getDocumentProxy(buf);
  const totalPages = pdf.numPages;
  const pages: PageText[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const pageResult = await extractText(pdf, { mergePages: false, pages: [p] });
    const pageText = Array.isArray(pageResult.text)
      ? pageResult.text.join('\n')
      : String(pageResult.text || '');
    pages.push({ pageNumber: p, text: pageText });
  }
  return { pages, totalPages };
}

interface DetectedLesson {
  title: string;
  lesson_type: 'lesson' | 'test_mid' | 'test_chapter' | 'test_cumulative' | 'intro';
  chapter_number: number | null;
  chapter_title: string | null;
  page_start: number;
  page_end: number | null;
  lesson_order: number;
}

function detectLessonsRegex(pages: PageText[]): DetectedLesson[] {
  const lessons: DetectedLesson[] = [];
  let currentChapter = { number: 0, title: '' };
  let orderCounter = 1;

  const chapterPattern = /الفصل\s+(\d+)\s*[:：]\s*(.+)/;
  const lessonPattern = /الدرس\s+(\d+)\s*[:：]\s*(.+)/;
  const testMidPattern = /اختبار\s+منتصف\s+الفصل/;
  const testChapterPattern = /اختبار\s+الفصل/;
  const testCumulativePattern = /الاختبار\s+التراكمي/;
  const introPattern = /الفصل\s+[:：]\s*التهيئة/;

  for (const page of pages) {
    const text = page.text;

    const chapterMatch = text.match(chapterPattern);
    if (chapterMatch) {
      currentChapter = {
        number: parseInt(chapterMatch[1]),
        title: chapterMatch[2].trim(),
      };
    }

    if (introPattern.test(text)) {
      lessons.push({
        title: `${currentChapter.title} - التهيئة`,
        lesson_type: 'intro',
        chapter_number: currentChapter.number,
        chapter_title: currentChapter.title,
        page_start: page.pageNumber,
        page_end: null,
        lesson_order: orderCounter++,
      });
      continue;
    }

    if (testMidPattern.test(text)) {
      lessons.push({
        title: `اختبار منتصف الفصل ${currentChapter.number}`,
        lesson_type: 'test_mid',
        chapter_number: currentChapter.number,
        chapter_title: currentChapter.title,
        page_start: page.pageNumber,
        page_end: null,
        lesson_order: orderCounter++,
      });
      continue;
    }

    if (testChapterPattern.test(text)) {
      lessons.push({
        title: `اختبار الفصل ${currentChapter.number}`,
        lesson_type: 'test_chapter',
        chapter_number: currentChapter.number,
        chapter_title: currentChapter.title,
        page_start: page.pageNumber,
        page_end: null,
        lesson_order: orderCounter++,
      });
      continue;
    }

    if (testCumulativePattern.test(text)) {
      lessons.push({
        title: `الاختبار التراكمي`,
        lesson_type: 'test_cumulative',
        chapter_number: currentChapter.number,
        chapter_title: currentChapter.title,
        page_start: page.pageNumber,
        page_end: null,
        lesson_order: orderCounter++,
      });
      continue;
    }

    const lessonMatch = text.match(lessonPattern);
    if (lessonMatch) {
      lessons.push({
        title: lessonMatch[2].trim(),
        lesson_type: 'lesson',
        chapter_number: currentChapter.number,
        chapter_title: currentChapter.title,
        page_start: page.pageNumber,
        page_end: null,
        lesson_order: orderCounter++,
      });
    }
  }

  for (let i = 0; i < lessons.length; i++) {
    if (i + 1 < lessons.length) {
      lessons[i].page_end = lessons[i + 1].page_start - 1;
    } else {
      lessons[i].page_end = pages[pages.length - 1].pageNumber;
    }
  }

  return lessons;
}

// ===== المعالج =====
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const jobId: string | undefined = body.jobId;

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiKey || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: 'إعداد بيئة ناقص' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // التقاط المهمّة
    let job;
    if (jobId) {
      const { data } = await supabase.from('ingestion_jobs').select('*').eq('id', jobId).single();
      job = data;
    } else {
      const { data } = await supabase
        .from('ingestion_jobs')
        .select('*')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      job = data;
    }

    if (!job) {
      return new Response(JSON.stringify({ message: 'لا توجد مهامّ معلّقة' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`معالجة المهمّة ${job.id}: ${job.file_path}`);

    // تحديث الحالة إلى processing
    await supabase.from('ingestion_jobs').update({ status: 'processing' }).eq('id', job.id);

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/${job.file_path}`;

    // الدفعة الأولى: كشف البنية
    if (job.last_page_done === 0) {
      console.log('الدفعة الأولى: استخراج البنية الكاملة...');
      const { pages, totalPages } = await extractAllPagesForStructure(fileUrl);
      const detected = detectLessonsRegex(pages);

      if (detected.length === 0) {
        await supabase
          .from('ingestion_jobs')
          .update({ status: 'failed', error_message: 'لم يُكتشف أي درس في الكتاب' })
          .eq('id', job.id);
        return new Response(
          JSON.stringify({ error: 'لم يُكتشف أي درس', jobId: job.id }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // إنشاء كل سجلات lessons
      const lessonsToInsert = detected.map((l) => ({
        subject_id: job.subject_id,
        grade_id: job.grade_id,
        title: l.title,
        part_number: job.part_number,
        lesson_order: l.lesson_order,
        chapter_number: l.chapter_number,
        chapter_title: l.chapter_title,
        lesson_type: l.lesson_type,
        page_start: l.page_start,
        page_end: l.page_end,
        status: 'processed',
      }));

      const { error: insertErr } = await supabase.from('lessons').insert(lessonsToInsert);
      if (insertErr) {
        await supabase
          .from('ingestion_jobs')
          .update({ status: 'failed', error_message: 'فشل إنشاء الدروس: ' + insertErr.message })
          .eq('id', job.id);
        throw new Error('فشل إنشاء الدروس: ' + insertErr.message);
      }

      await supabase
        .from('ingestion_jobs')
        .update({ total_pages: totalPages, lessons_created: detected.length })
        .eq('id', job.id);

      console.log(`تم إنشاء ${detected.length} دروس لـ${totalPages} صفحة`);
    }

    // معالجة دفعة من الصفحات
    const { data: jobData } = await supabase.from('ingestion_jobs').select('*').eq('id', job.id).single();
    if (!jobData) throw new Error('لم تُعثَر المهمّة');

    const startPage = jobData.last_page_done + 1;
    const endPage = Math.min(startPage + BATCH_SIZE - 1, jobData.total_pages || 9999);

    console.log(`معالجة الصفحات ${startPage}-${endPage}`);

    const batchPages = await extractPdfPages(fileUrl, startPage, endPage);

    // جلب جميع الدروس لهذا الكتاب
    const { data: allLessons } = await supabase
      .from('lessons')
      .select('id, page_start, page_end')
      .eq('subject_id', jobData.subject_id)
      .eq('part_number', jobData.part_number);

    if (!allLessons || allLessons.length === 0) {
      throw new Error('لم تُعثَر دروس لهذا الكتاب');
    }

    let chunksAdded = 0;

    // لكل صفحة في الدفعة، حدّد الدرس المناسب
    for (const page of batchPages) {
      const lesson = allLessons.find(
        (l) => l.page_start <= page.pageNumber && (l.page_end || 9999) >= page.pageNumber
      );
      if (!lesson) continue;

      const pageChunks = chunkText(page.text);
      for (const chunk of pageChunks) {
        const embedding = await embed(chunk, geminiKey);
        await supabase.from('lesson_chunks').insert({
          lesson_id: lesson.id,
          subject: 'math',
          grade_order: 1,
          chunk_index: chunksAdded,
          content: chunk,
          page_number: page.pageNumber,
          part_number: jobData.part_number,
          embedding,
        });
        chunksAdded++;
      }
    }

    const newLastPage = endPage;
    const isDone = newLastPage >= (jobData.total_pages || 0);

    await supabase
      .from('ingestion_jobs')
      .update({
        last_page_done: newLastPage,
        chunks_created: (jobData.chunks_created || 0) + chunksAdded,
        status: isDone ? 'done' : 'processing',
      })
      .eq('id', job.id);

    console.log(`تمّ: ${chunksAdded} مقطع، الحالة: ${isDone ? 'done' : 'processing'}`);

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: isDone ? 'done' : 'processing',
        last_page_done: newLastPage,
        total_pages: jobData.total_pages,
        chunks_created: chunksAdded,
        progress: jobData.total_pages ? ((newLastPage / jobData.total_pages) * 100).toFixed(1) : 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('خطأ:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'خطأ غير متوقّع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
