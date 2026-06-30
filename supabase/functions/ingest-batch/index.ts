// supabase/functions/ingest-batch/index.ts
// معالجة دفعات صغيرة (~10 صفحات) دون تحميل الكتاب كاملاً
// كشف تدريجي للبنية — حلّ WORKER_RESOURCE_LIMIT جذرياً

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMBED_MODEL = 'text-embedding-004';
const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const PAGES_PER_BATCH = 10; // صفحات لكل دفعة

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

// قراءة نطاق صفحات من الجدول المخزّن مسبقاً (بلا تحميل PDF)
async function getPageRangeFromCache(supabase: any, jobId: string, startPage: number, endPage: number): Promise<PageText[]> {
  const { data, error } = await supabase
    .from('pdf_text_cache')
    .select('page_number, page_text')
    .eq('job_id', jobId)
    .gte('page_number', startPage)
    .lte('page_number', endPage)
    .order('page_number', { ascending: true });

  if (error) throw new Error(`فشل قراءة النصّ من الذاكرة المؤقتة: ${error.message}`);
  if (!data || data.length === 0) throw new Error('لا يوجد نصّ مخزّن لهذا النطاق');

  return data.map((row: any) => ({
    pageNumber: row.page_number,
    text: row.page_text,
  }));
}

interface DetectedLesson {
  title: string;
  lesson_type: 'lesson' | 'test_mid' | 'test_chapter' | 'test_cumulative' | 'intro';
  chapter_number: number | null;
  chapter_title: string | null;
  page_start: number;
}

// كشف الدروس في صفحات الدفعة فقط
function detectLessonsInBatch(pages: PageText[], currentChapter: { number: number; title: string }): { lessons: DetectedLesson[]; lastChapter: { number: number; title: string } } {
  const lessons: DetectedLesson[] = [];
  let chapter = { ...currentChapter };

  // إزالة علامات Unicode الاتّجاهية (LRM, RLM, PDF markers)
  const cleanText = (text: string) => text.replace(/[\u200E\u200F\u202A-\u202E]/g, '').replace(/\s+/g, ' ');

  // أنماط محسّنة لكشف البنية
  // ملاحظة: بعد cleanText، النص "الدرس : 3التصنيف" (بلا مسافة بين الرقم والعنوان!)
  const chapterPattern = /الفصل\s+[:：]\s*(\d+)\s*[:：]?\s*(.+)/;
  const lessonNumPattern = /الدرس\s+[:：]\s*(\d+)\s*(.+)/; // "الدرس : 3التصنيف" (قد لا توجد مسافة)
  const lessonCodePattern = /^(\d+)-(\d+)\s+(.+)/; // "5-1 العنوان" (فصل-درس)
  const testMidPattern = /اختبار\s+منتصف\s+الفصل/;
  const testChapterPattern = /اختبار\s+الفصل/;
  const testCumulativePattern = /الاختبار\s+التراكمي/;
  const introPattern = /الفصل\s*[:：]?\s*التهيئة/;

  for (const page of pages) {
    const text = cleanText(page.text);
    const textLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);

    // ١. كشف الفصل الصريح "الفصل : N العنوان"
    const chapterMatch = text.match(chapterPattern);
    if (chapterMatch) {
      chapter = {
        number: parseInt(chapterMatch[1]),
        title: chapterMatch[2].trim(),
      };
      console.log(`[Page ${page.pageNumber}] فصل جديد: ${chapter.number} - ${chapter.title}`);
    }

    // ٢. كشف الاختبارات (قبل الدروس لأنها أولوية)
    if (introPattern.test(text)) {
      const chNum = chapter.number || 1;
      lessons.push({
        title: `${chapter.title || 'الفصل ' + chNum} - التهيئة`,
        lesson_type: 'intro',
        chapter_number: chNum,
        chapter_title: chapter.title || `الفصل ${chNum}`,
        page_start: page.pageNumber,
      });
      console.log(`[Page ${page.pageNumber}] تهيئة: فصل ${chNum}`);
      continue;
    }

    if (testMidPattern.test(text)) {
      const chNum = chapter.number || 1;
      lessons.push({
        title: `اختبار منتصف الفصل ${chNum}`,
        lesson_type: 'test_mid',
        chapter_number: chNum,
        chapter_title: chapter.title || `الفصل ${chNum}`,
        page_start: page.pageNumber,
      });
      console.log(`[Page ${page.pageNumber}] اختبار منتصف: فصل ${chNum}`);
      continue;
    }

    if (testChapterPattern.test(text)) {
      const chNum = chapter.number || 1;
      lessons.push({
        title: `اختبار الفصل ${chNum}`,
        lesson_type: 'test_chapter',
        chapter_number: chNum,
        chapter_title: chapter.title || `الفصل ${chNum}`,
        page_start: page.pageNumber,
      });
      console.log(`[Page ${page.pageNumber}] اختبار فصل: ${chNum}`);
      continue;
    }

    if (testCumulativePattern.test(text)) {
      const chNum = chapter.number || 1;
      lessons.push({
        title: `الاختبار التراكمي`,
        lesson_type: 'test_cumulative',
        chapter_number: chNum,
        chapter_title: chapter.title || `الفصل ${chNum}`,
        page_start: page.pageNumber,
      });
      console.log(`[Page ${page.pageNumber}] اختبار تراكمي`);
      continue;
    }

    // ٣. كشف الدروس: نمط "N-M العنوان" (فصل-درس) - أولوية أعلى
    let foundLesson = false;
    for (const line of textLines) {
      const lessonCodeMatch = line.match(lessonCodePattern);
      if (lessonCodeMatch) {
        const chapterNum = parseInt(lessonCodeMatch[1]);
        const lessonNum = parseInt(lessonCodeMatch[2]);
        const title = lessonCodeMatch[3].trim();

        // تحديث الفصل الحالي
        if (chapterNum !== chapter.number) {
          chapter = {
            number: chapterNum,
            title: `الفصل ${chapterNum}`,
          };
        }

        lessons.push({
          title: title,
          lesson_type: 'lesson',
          chapter_number: chapterNum,
          chapter_title: chapter.title,
          page_start: page.pageNumber,
        });
        console.log(`[Page ${page.pageNumber}] درس (نمط N-M): ${chapterNum}-${lessonNum} ${title}`);
        foundLesson = true;
        break;
      }
    }
    if (foundLesson) continue;

    // ٤. كشف الدروس: نمط "الدرس : N العنوان" (استخدم الفصل المتتبع)
    const lessonNumMatch = text.match(lessonNumPattern);
    if (lessonNumMatch) {
      const lessonNumber = parseInt(lessonNumMatch[1]);
      const title = lessonNumMatch[2].trim();
      const chNum = chapter.number || 1; // افتراضي 1 إن لم يمر فصل

      lessons.push({
        title: title,
        lesson_type: 'lesson',
        chapter_number: chNum,
        chapter_title: chapter.title || `الفصل ${chNum}`,
        page_start: page.pageNumber,
      });
      console.log(`[Page ${page.pageNumber}] درس (نمط عادي): ${lessonNumber}. ${title} (فصل ${chNum})`);
      continue;
    }
  }

  return { lessons, lastChapter: chapter };
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

    console.log(`[Job ${job.id}] معالجة: ${job.file_path}`);

    // التحقّق من استخراج النصّ مسبقاً
    if (!job.total_pages) {
      return new Response(
        JSON.stringify({ error: 'يجب استخراج نصّ الكتاب أولاً (text_extracted=false)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // الخطوة ٢: تحديد نطاق الدفعة
    const from = job.last_page_done + 1;
    const to = Math.min(from + PAGES_PER_BATCH - 1, job.total_pages);

    if (from > job.total_pages) {
      await supabase.from('ingestion_jobs').update({ status: 'done' }).eq('id', job.id);
      return new Response(
        JSON.stringify({ jobId: job.id, status: 'done', message: 'اكتمل الاستيعاب' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Job] معالجة الصفحات ${from}-${to}`);

    // الخطوة ٣: قراءة صفحات الدفعة من الذاكرة المؤقتة
    const pages = await getPageRangeFromCache(supabase, job.id, from, to);

    // الخطوة ٤: كشف الدروس في هذه الدفعة
    const currentChapter = {
      number: job.current_chapter_number || 0,
      title: job.current_chapter_title || '',
    };
    const { lessons: detectedLessons, lastChapter } = detectLessonsInBatch(pages, currentChapter);
    console.log(`[Job] كُشف ${detectedLessons.length} عنصر (دروس/اختبارات) في الصفحات ${from}-${to}`);

    let currentLessonId = job.current_lesson_id;
    let lessonsCreatedCount = 0;

    // الخطوة ٥: إنشاء/تحديث سجلات الدروس
    for (const detected of detectedLessons) {
      // إغلاق الدرس السابق
      if (currentLessonId) {
        await supabase
          .from('lessons')
          .update({ page_end: detected.page_start - 1 })
          .eq('id', currentLessonId);
      }

      // إنشاء درس جديد
      const { data: newLesson, error: insertError } = await supabase
        .from('lessons')
        .insert({
          subject_id: job.subject_id,
          title: detected.title,
          part_number: job.part_number,
          chapter_number: detected.chapter_number,
          chapter_title: detected.chapter_title,
          lesson_type: detected.lesson_type,
          page_start: detected.page_start,
          page_end: null, // سيُحدّث لاحقاً
          status: 'processing',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`[Job] فشل إنشاء الدرس "${detected.title}":`, insertError.message, insertError.code, insertError.details);
      } else if (newLesson) {
        currentLessonId = newLesson.id;
        lessonsCreatedCount++;
        console.log(`[Job] درس جديد: ${detected.title} (ص${detected.page_start})`);
      } else {
        console.warn(`[Job] لا بيانات من إدراج "${detected.title}" (بلا خطأ)`);
      }
    }

    // الخطوة ٦: التضمين (embeddings)
    let chunksCreatedCount = 0;

    if (currentLessonId) {
      for (const page of pages) {
        const pageChunks = chunkText(page.text);
        for (const chunk of pageChunks) {
          const embedding = await embed(chunk, geminiKey);
          await supabase.from('lesson_chunks').insert({
            lesson_id: currentLessonId,
            subject: 'math',
            grade_order: 1,
            chunk_index: chunksCreatedCount,
            content: chunk,
            page_number: page.pageNumber,
            part_number: job.part_number,
            embedding,
          });
          chunksCreatedCount++;
        }
      }
    }

    // الخطوة ٧: تحديث التقدّم
    const isDone = to >= job.total_pages;

    if (isDone && currentLessonId) {
      // إغلاق آخر درس
      await supabase
        .from('lessons')
        .update({ page_end: job.total_pages, status: 'processed' })
        .eq('id', currentLessonId);
    }

    await supabase
      .from('ingestion_jobs')
      .update({
        last_page_done: to,
        lessons_created: (job.lessons_created || 0) + lessonsCreatedCount,
        chunks_created: (job.chunks_created || 0) + chunksCreatedCount,
        current_lesson_id: currentLessonId,
        current_chapter_number: lastChapter.number,
        current_chapter_title: lastChapter.title,
        status: isDone ? 'done' : 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    console.log(`[Job] تمّ: ${chunksCreatedCount} مقطع، ${lessonsCreatedCount} درس، الحالة: ${isDone ? 'done' : 'processing'}`);

    return new Response(
      JSON.stringify({
        jobId: job.id,
        status: isDone ? 'done' : 'processing',
        last_page_done: to,
        total_pages: job.total_pages,
        lessons_created: lessonsCreatedCount,
        chunks_created: chunksCreatedCount,
        progress: ((to / job.total_pages) * 100).toFixed(1) + '%',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Job] خطأ:', err);

    // تسجيل الخطأ في المهمّة
    const body = await req.json().catch(() => ({}));
    const jobId = body.jobId;

    if (jobId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'failed',
            error_message: err.message || 'خطأ غير متوقّع',
          })
          .eq('id', jobId);
      }
    }

    return new Response(
      JSON.stringify({ error: err.message || 'خطأ غير متوقّع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
