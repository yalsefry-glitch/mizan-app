// supabase/functions/ingest-vision/index.ts
// استخراج بنية الكتاب المدرسيّ من صور الصفحات عبر Gemini Vision (gemini-2.5-flash).
// تقرأ كل صفحة (صورة PNG) من bucket التخزين العامّ lesson_pages، ترسلها منفردة
// إلى Gemini لاستخراج النصّ العربيّ الصحيح واستنتاج بنية الصفحة، وتُرجع JSON نظيفًا.
//
// وضعان:
//   mode='preview' (الافتراضيّ): يعالج كامل النطاق page_from..page_to ويُرجع JSON فقط،
//                                بلا أي كتابة في القاعدة. (المسار الذي أثبت الجودة — لم يُمَسّ.)
//   mode='commit': يعالج دفعة صغيرة (batch_size صفحات تبدأ من page_from)، يجمعها في دروس
//                  (القاعدة الذهبيّة: درس واحد = سطر واحد)، ويكتب lessons + lesson_chunks
//                  مع embeddings، ثمّ يُرجع next_page للاستدعاء التالي (حلّ مهلة ١٥٠ ثانية).
//
// المفاتيح المطلوبة: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// النموذج مثبّت صراحةً كما طُلب — الدقّة أولًا، لا مساومة.
const VISION_MODEL = 'gemini-2.5-flash';
// نموذج التضمين (منسوخ حرفيًّا من ingest-batch — نفس الأبعاد ٧٦٨).
const EMBED_MODEL = 'gemini-embedding-001';

// رابط التخزين العامّ الافتراضيّ (يُشتقّ من SUPABASE_URL إن توفّر).
const FALLBACK_SUPABASE_URL = 'https://lzfgjvafmvofwjiyvelq.supabase.co';

// حدّ أمان لعدد الصفحات في طلب المعاينة الواحد.
const MAX_PAGES_PER_REQUEST = 200;
// حدّ أمان لحجم الدفعة في وضع commit (يبقي الاستدعاء ضمن المهلة).
const MAX_BATCH_SIZE = 12;
const DEFAULT_BATCH_SIZE = 3;

// أنواع الصفحات المسموحة (تُستخدم للتحقّق من ردّ Gemini).
const ALLOWED_PAGE_TYPES = [
  'lesson',
  'test_mid',
  'test_chapter',
  'test_cumulative',
  'intro',
  'teacher',
  'cover',
  'other',
];

// أنواع تُكتب في جدول lessons (lesson_type). الباقي (cover/teacher/other) يُتجاهَل تمامًا.
const WRITABLE_TYPES = ['lesson', 'intro', 'test_mid', 'test_chapter', 'test_cumulative'];

// تعليمات النظام الصارمة لاستخراج بنية الصفحة (بالعربيّة، حرفيًّا كما هي مطلوبة).
const SYSTEM_PROMPT = `أنت محلل مناهج تعليمية سعودية خبير. سأعطيك صورة صفحة واحدة من كتاب مدرسي رسمي (منهج عين). استخرج منها بدقة 100%:
1. النص العربي الكامل المقروء في الصفحة، نظيفاً وصحيحاً كما يراه القارئ (صحّح أي تقطيع، اكتب الكلمات متصلة سليمة، بلا تشكيل زائد إلا ما يلزم).
2. صنّف نوع الصفحة بدقة إلى واحد من: 'lesson' (درس)، 'test_mid' (اختبار منتصف الفصل)، 'test_chapter' (اختبار الفصل)، 'test_cumulative' (اختبار تراكمي/مراجعة تراكمية)، 'intro' (تهيئة)، 'teacher' (صفحة للمعلم/إرشادات)، 'cover' (غلاف/فهرس)، 'other'.
3. إن كانت درساً: استخرج رقم الدرس وعنوانه الصحيح، ورقم الفصل وعنوانه إن ظهر.
4. إن كانت اختباراً أو تهيئة: استخرج رقم الفصل المرتبط.
أعد فقط JSON خالصاً بلا أي نص قبله أو بعده أو علامات markdown، بهذا الشكل بالضبط:
{"page_type":"lesson|test_mid|test_chapter|test_cumulative|intro|teacher|cover|other","chapter_number":<رقم أو null>,"chapter_title":"<نص أو فارغ>","lesson_number":<رقم أو null>,"lesson_title":"<نص أو فارغ>","full_text":"<النص العربي الكامل النظيف>"}`;

// نتيجة صفحة واحدة بعد التحليل.
interface PageResult {
  page_number: number;
  image_url: string;
  ok: boolean;
  page_type?: string;
  chapter_number?: number | null;
  chapter_title?: string;
  lesson_number?: number | null;
  lesson_title?: string;
  full_text?: string;
  error?: string;
  raw?: string; // نصّ Gemini الخام عند فشل التحليل (لتشخيص الجودة).
}

// عنصر قابل للكتابة (درس/اختبار/تهيئة) بعد تجميع الصفحات المتتالية.
interface WriteItem {
  lesson_type: string;
  title: string;
  chapter_number: number | null;
  chapter_title: string;
  page_start: number;
  page_end: number;
  pages: PageResult[];
  mergeKey: string;
}

// ===== التضمين (embedding) — منسوخ حرفيًّا من ingest-batch، أبعاد ٧٦٨ =====
async function embed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/' + EMBED_MODEL,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  if (!res.ok) throw new Error('فشل توليد embedding: ' + (await res.text()));
  const data = await res.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error('ردّ embedding بلا قيم');
  return values;
}

// تحويل بايتات إلى base64 على دفعات (يتجنّب تجاوز مكدّس الاستدعاء للصور الكبيرة).
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// تنظيف ردّ Gemini وتحليله JSON بأمان (يزيل أسوار الشيفرة ويقتطع بين أول { وآخر }).
function safeParseJson(text: string): { value: any | null; cleaned: string } {
  let cleaned = (text || '').trim();
  // إزالة أسوار الشيفرة إن وُجدت.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  // اقتطاع أوّل كائن JSON كامل (حماية من أي نصّ زائد قبله أو بعده).
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return { value: JSON.parse(cleaned), cleaned };
  } catch {
    return { value: null, cleaned };
  }
}

// تطبيع رقم: يقبل عددًا أو نصًّا رقميًّا، وإلّا null.
function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// بناء رابط صورة الصفحة العامّ (page-NNN.png بثلاثة أرقام).
function buildImageUrl(storageBase: string, bookSlug: string, pageNumber: number): string {
  const nnn = String(pageNumber).padStart(3, '0');
  return `${storageBase}/storage/v1/object/public/lesson_pages/${bookSlug}/page-${nnn}.png`;
}

// استخراج بنية صفحة واحدة عبر Gemini Vision.
async function extractPage(
  pageNumber: number,
  bookSlug: string,
  storageBase: string,
  geminiKey: string
): Promise<PageResult> {
  const imageUrl = buildImageUrl(storageBase, bookSlug, pageNumber);

  try {
    // (١) تحميل الصورة.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return {
        page_number: pageNumber,
        image_url: imageUrl,
        ok: false,
        error: `فشل تحميل الصورة (HTTP ${imgRes.status})`,
      };
    }
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length === 0) {
      return { page_number: pageNumber, image_url: imageUrl, ok: false, error: 'الصورة فارغة' };
    }
    const base64 = bytesToBase64(bytes);

    // (٢) إرسال الصورة إلى Gemini مع تعليمات النظام الصارمة.
    const aiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        VISION_MODEL +
        ':generateContent?key=' +
        geminiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: 'image/png', data: base64 } },
                { text: 'حلّل هذه الصفحة وأعد JSON فقط حسب التعليمات.' },
              ],
            },
          ],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return {
        page_number: pageNumber,
        image_url: imageUrl,
        ok: false,
        error: `فشل اتّصال Gemini (HTTP ${aiRes.status}): ${detail.slice(0, 300)}`,
      };
    }

    const data = await aiRes.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // (٣) تحليل الردّ بأمان.
    const { value, cleaned } = safeParseJson(text);
    if (!value || typeof value !== 'object') {
      return {
        page_number: pageNumber,
        image_url: imageUrl,
        ok: false,
        error: 'تعذّر تحليل ردّ Gemini كـ JSON',
        raw: cleaned.slice(0, 1000),
      };
    }

    // (٤) تطبيع الحقول والتحقّق من نوع الصفحة.
    const pageType =
      typeof value.page_type === 'string' && ALLOWED_PAGE_TYPES.includes(value.page_type)
        ? value.page_type
        : 'other';

    return {
      page_number: pageNumber,
      image_url: imageUrl,
      ok: true,
      page_type: pageType,
      chapter_number: toNumberOrNull(value.chapter_number),
      chapter_title: typeof value.chapter_title === 'string' ? value.chapter_title : '',
      lesson_number: toNumberOrNull(value.lesson_number),
      lesson_title: typeof value.lesson_title === 'string' ? value.lesson_title : '',
      full_text: typeof value.full_text === 'string' ? value.full_text : '',
    };
  } catch (err: any) {
    return {
      page_number: pageNumber,
      image_url: imageUrl,
      ok: false,
      error: String(err?.message || err),
    };
  }
}

// تنظيف عنوان الدرس من الضوضاء قبل الكتابة:
// - يزيل رمز الدرس البادئ مثل "1-1" أو "١-١".
// - يزيل أي رقم ملحق بنهاية العنوان (صفحة/عدد) عربيًّا (٠-٩) أو لاتينيًّا (0-9).
// - يقلّم المسافات الزائدة (بما فيها المتكرّرة داخليًّا).
function cleanTitle(s: string): string {
  let t = (s || '').trim();
  // رمز درس بادئ: أرقام - أرقام (يدعم الشرطة العاديّة والطويلة وعلامة الطرح).
  t = t.replace(/^[\d٠-٩]+\s*[-–−]\s*[\d٠-٩]+\s*/, '');
  // رقم ملحق بنهاية العنوان (مع المسافات المحيطة).
  t = t.replace(/\s*[\d٠-٩]+\s*$/, '');
  // تقليم المسافات الزائدة.
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// عنوان مناسب للعنصر (درس بعنوانه، أو عنوان اختبار/تهيئة مشتقّ).
function buildTitle(pageType: string, lessonTitle: string, chapterNumber: number | null): string {
  const t = cleanTitle(lessonTitle || '');
  switch (pageType) {
    case 'lesson':
      return t || 'درس';
    case 'intro':
      return t || (chapterNumber ? `تهيئة الفصل ${chapterNumber}` : 'تهيئة');
    case 'test_mid':
      return 'اختبار منتصف الفصل';
    case 'test_chapter':
      return chapterNumber ? `اختبار الفصل ${chapterNumber}` : 'اختبار الفصل';
    case 'test_cumulative':
      return 'اختبار تراكمي';
    default:
      return t || 'عنصر';
  }
}

// مفتاح الدمج (لا يعتمد على العنوان الحرفيّ إطلاقًا):
// - الدروس برقم معروف: chapter_number + lesson_number (فصفحتا الدرس الواحد لهما نفسهما، فتُدمجان).
// - الدروس بلا رقم (lesson_number=null): مفتاح فريد بالصفحة حتى لا تُدمج بالرقم المشترك null خطأً؛
//   الدمج عندئذٍ يتمّ في groupPages بتطابق العنوان المنظّف مع الصفحة السابقة المتتالية فقط.
// - الاختبارات/التهيئة: chapter_number + page_type (فصفحات الاختبار/التهيئة الواحدة تُدمج).
function mergeKeyFor(
  pageType: string,
  chapterNumber: number | null,
  lessonNumber: number | null,
  pageNumber: number
): string {
  if (pageType === 'lesson') {
    if (lessonNumber === null) return `lesson|ch:${chapterNumber ?? 'na'}|ln:na|p:${pageNumber}`;
    return `lesson|ch:${chapterNumber ?? 'na'}|ln:${lessonNumber}`;
  }
  return `${pageType}|ch:${chapterNumber ?? 'na'}`;
}

// تجميع الصفحات المتتالية في عناصر قابلة للكتابة (القاعدة الذهبيّة: درس واحد = عنصر واحد).
// يتجاهل cover/teacher/other. الصفحات المفقودة (التي فشل استخراجها) تكسر التتابع طبيعيًّا.
// initialChapter: آخر فصل معروف من القاعدة قبل هذه الدفعة (وراثة دائمة عبر الدفعات).
function groupPages(okPages: PageResult[], initialChapter: number | null = null): WriteItem[] {
  const items: WriteItem[] = [];
  let current: WriteItem | null = null;
  let lastChapter: number | null = initialChapter; // يبدأ بآخر فصل من القاعدة، لا null.

  const sorted = [...okPages].sort((a, b) => a.page_number - b.page_number);

  for (const p of sorted) {
    const type = p.page_type || 'other';
    if (!WRITABLE_TYPES.includes(type)) {
      // صفحة غير قابلة للكتابة (غلاف/معلم/أخرى) → تُنهي العنصر الجاري وتُتجاهَل.
      current = null;
      continue;
    }

    // وراثة آخر رقم فصل معروف: صفحة بـ chapter_number=null ترث آخر فصل (من الدفعة أو القاعدة).
    const effectiveChapter = p.chapter_number ?? lastChapter;
    if (p.chapter_number !== null && p.chapter_number !== undefined) {
      lastChapter = p.chapter_number;
    }

    const lessonNumber = p.lesson_number ?? null;
    const key = mergeKeyFor(type, effectiveChapter, lessonNumber, p.page_number);
    const consecutive = !!current && p.page_number === current.page_end + 1;

    // (أ) دمج عاديّ بالمفتاح المشترك (فصل+رقم درس، أو فصل+نوع للاختبارات/التهيئة).
    const mergeByKey = !!current && current.mergeKey === key && consecutive;

    // (ب) احتياط للدروس بلا رقم درس (null): لا تُدمج بالرقم المشترك (مفتاحها فريد بالصفحة)،
    //     بل تُدمج فقط إذا تطابق عنوانها المنظّف مع الصفحة السابقة المتتالية.
    const cleanedIncoming = cleanTitle(p.lesson_title || '');
    const mergeByTitle =
      !!current &&
      current.lesson_type === 'lesson' &&
      type === 'lesson' &&
      lessonNumber === null &&
      consecutive &&
      cleanedIncoming !== '' &&
      cleanedIncoming === current.title;

    if (mergeByKey || mergeByTitle) {
      // استمرار نفس العنصر: نمدّ النطاق، ونُبقي عنوان الصفحة الأولى (الطالب) ونتجاهل الثانية.
      current!.page_end = p.page_number;
      current!.pages.push(p);
    } else {
      // عنصر جديد — عنوانه من الصفحة الأولى، وفصله هو الفصل الفعليّ (بعد الوراثة).
      current = {
        lesson_type: type,
        title: buildTitle(type, p.lesson_title || '', effectiveChapter),
        chapter_number: effectiveChapter,
        chapter_title: p.chapter_title || '',
        page_start: p.page_number,
        page_end: p.page_number,
        pages: [p],
        mergeKey: key,
      };
      items.push(current);
    }
  }

  return items;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const subjectId: string = body.subject_id || '';
    const gradeId: string = body.grade_id || '';
    const partNumber = toNumberOrNull(body.part_number);
    const bookSlug: string = (body.book_slug || '').trim();
    const pageFrom = toNumberOrNull(body.page_from);
    const pageTo = toNumberOrNull(body.page_to);
    const mode: string = body.mode === 'commit' ? 'commit' : 'preview';

    let batchSize = toNumberOrNull(body.batch_size) ?? DEFAULT_BATCH_SIZE;
    if (batchSize < 1) batchSize = DEFAULT_BATCH_SIZE;
    if (batchSize > MAX_BATCH_SIZE) batchSize = MAX_BATCH_SIZE;

    // ===== التحقّق من المدخلات =====
    if (!bookSlug) return json({ error: 'book_slug مطلوب' }, 400);
    if (pageFrom === null || pageTo === null) {
      return json({ error: 'page_from و page_to مطلوبان (أرقام)' }, 400);
    }
    if (pageFrom < 1 || pageTo < pageFrom) {
      return json({ error: 'نطاق صفحات غير صالح (page_from ≥ 1 و page_to ≥ page_from)' }, 400);
    }

    // ===== الأسرار =====
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || FALLBACK_SUPABASE_URL;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY غير مضبوط في الخادم' }, 500);
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط في الخادم' }, 500);

    const storageBase = supabaseUrl.replace(/\/+$/, '');
    const supabase = createClient(supabaseUrl, serviceKey);

    // ============================================================
    // وضع المعاينة: كامل النطاق، بلا كتابة (لم يُمَسّ منطقه المثبَت).
    // ============================================================
    if (mode === 'preview') {
      const totalPages = pageTo - pageFrom + 1;
      if (totalPages > MAX_PAGES_PER_REQUEST) {
        return json(
          { error: `النطاق كبير جدًّا (${totalPages} صفحة). الحدّ ${MAX_PAGES_PER_REQUEST} في المعاينة.` },
          400
        );
      }

      const results: PageResult[] = [];
      for (let p = pageFrom; p <= pageTo; p++) {
        results.push(await extractPage(p, bookSlug, storageBase, geminiKey));
      }

      const okCount = results.filter((r) => r.ok).length;
      return json({
        mode: 'preview',
        committed: false,
        summary: {
          book_slug: bookSlug,
          subject_id: subjectId,
          grade_id: gradeId,
          part_number: partNumber,
          page_from: pageFrom,
          page_to: pageTo,
          total: results.length,
          ok: okCount,
          failed: results.length - okCount,
        },
        pages: results,
      });
    }

    // ============================================================
    // وضع الكتابة (commit): دفعة واحدة (batch_size صفحة) + كتابة + next_page.
    // ============================================================
    if (!subjectId) return json({ error: 'subject_id مطلوب في وضع commit' }, 400);
    if (partNumber === null) return json({ error: 'part_number مطلوب في وضع commit' }, 400);

    const batchEnd = Math.min(pageFrom + batchSize - 1, pageTo);
    const nextPage = batchEnd < pageTo ? batchEnd + 1 : null;

    // (١) استخراج صفحات الدفعة (فشل صفحة لا يوقف البقيّة).
    const results: PageResult[] = [];
    for (let p = pageFrom; p <= batchEnd; p++) {
      results.push(await extractPage(p, bookSlug, storageBase, geminiKey));
    }

    // (٢) تجميع الصفحات الناجحة في دروس/اختبارات (القاعدة الذهبيّة).
    // وراثة الفصل عبر الدفعات: أعلى chapter_number لدرس سابق (page_start < page_from) لنفس المادة/الجزء.
    let initialChapter: number | null = null;
    const { data: prevChapterRow } = await supabase
      .from('lessons')
      .select('chapter_number')
      .eq('subject_id', subjectId)
      .eq('part_number', partNumber)
      .lt('page_start', pageFrom)
      .not('chapter_number', 'is', null)
      .order('chapter_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevChapterRow?.chapter_number !== null && prevChapterRow?.chapter_number !== undefined) {
      initialChapter = prevChapterRow.chapter_number;
    }

    const okPages = results.filter((r) => r.ok);
    const items = groupPages(okPages, initialChapter);

    // (٣) كتابة كل عنصر: lessons (upsert/استمرار) ثمّ lesson_chunks مع embeddings.
    let lessonsWritten = 0;
    let chunksWritten = 0;
    const itemReports: any[] = [];

    for (const item of items) {
      try {
        let lessonId: string | null = null;

        // (أ) استمرار درس بدأ في دفعة سابقة: نفس المادة/الجزء/النوع/العنوان وينتهي عند page_start-1.
        const { data: prev } = await supabase
          .from('lessons')
          .select('id, page_end')
          .eq('subject_id', subjectId)
          .eq('part_number', partNumber)
          .eq('lesson_type', item.lesson_type)
          .eq('title', item.title)
          .eq('page_end', item.page_start - 1)
          .maybeSingle();

        if (prev?.id) {
          // نمدّد الدرس الموجود (يبقى سطرًا واحدًا عبر حدود الدفعات).
          await supabase
            .from('lessons')
            .update({ page_end: item.page_end })
            .eq('id', prev.id);
          lessonId = prev.id;
        } else {
          // (ب) درس/اختبار جديد — upsert يمنع التكرار عند إعادة التشغيل.
          const { data: newLesson, error: upErr } = await supabase
            .from('lessons')
            .upsert(
              {
                subject_id: subjectId,
                title: item.title,
                part_number: partNumber,
                chapter_number: item.chapter_number,
                chapter_title: item.chapter_title,
                lesson_type: item.lesson_type,
                lesson_order: item.page_start, // مفتاح ترتيب مستقرّ بترتيب القراءة (idempotent).
                page_start: item.page_start,
                page_end: item.page_end,
                status: 'processed',
              },
              {
                onConflict: 'subject_id,part_number,page_start,lesson_type',
                ignoreDuplicates: false,
              }
            )
            .select('id')
            .single();

          if (upErr || !newLesson) {
            itemReports.push({
              title: item.title,
              lesson_type: item.lesson_type,
              page_start: item.page_start,
              page_end: item.page_end,
              ok: false,
              error: upErr?.message || 'فشل إنشاء الدرس (بلا بيانات)',
            });
            continue;
          }
          lessonId = newLesson.id;
        }

        lessonsWritten++;

        // (ج) كتابة مقاطع الدرس (صفحة = مقطع، نصّها الكامل + صورتها + تضمينها).
        let itemChunks = 0;
        const chunkErrors: string[] = [];
        for (const page of item.pages) {
          const fullText = (page.full_text || '').trim();
          if (!fullText) {
            chunkErrors.push(`صفحة ${page.page_number}: نصّ فارغ — تُخطّت`);
            continue;
          }
          try {
            const embedding = await embed(fullText, geminiKey);
            // idempotent: نحذف مقطع هذه الصفحة إن وُجد من تشغيل سابق ثمّ نُدرج.
            await supabase
              .from('lesson_chunks')
              .delete()
              .eq('lesson_id', lessonId)
              .eq('part_number', partNumber)
              .eq('page_number', page.page_number);
            const { error: chErr } = await supabase.from('lesson_chunks').insert({
              lesson_id: lessonId,
              subject: subjectId, // العمود الفعليّ نصّ (subject) — لا يوجد subject_id في lesson_chunks.
              chunk_index: page.page_number,
              content: fullText,
              page_number: page.page_number,
              part_number: partNumber,
              page_image_url: page.image_url,
              embedding,
            });
            if (chErr) {
              chunkErrors.push(`صفحة ${page.page_number}: ${chErr.message}`);
            } else {
              itemChunks++;
              chunksWritten++;
            }
          } catch (e: any) {
            chunkErrors.push(`صفحة ${page.page_number}: ${String(e?.message || e)}`);
          }
        }

        itemReports.push({
          title: item.title,
          lesson_type: item.lesson_type,
          chapter_number: item.chapter_number,
          page_start: item.page_start,
          page_end: item.page_end,
          ok: true,
          continued: !!prev?.id,
          chunks_written: itemChunks,
          chunk_errors: chunkErrors,
        });
      } catch (e: any) {
        itemReports.push({
          title: item.title,
          lesson_type: item.lesson_type,
          page_start: item.page_start,
          page_end: item.page_end,
          ok: false,
          error: String(e?.message || e),
        });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return json({
      mode: 'commit',
      committed: true,
      summary: {
        book_slug: bookSlug,
        subject_id: subjectId,
        grade_id: gradeId,
        part_number: partNumber,
        batch_from: pageFrom,
        batch_to: batchEnd,
        pages_extracted: results.length,
        pages_ok: okCount,
        pages_failed: results.length - okCount,
        lessons_written: lessonsWritten,
        chunks_written: chunksWritten,
      },
      next_page: nextPage, // استدعِ الدالّة ثانيةً بـ page_from=next_page حتى يصبح null.
      items: itemReports,
      pages: results,
    });
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
