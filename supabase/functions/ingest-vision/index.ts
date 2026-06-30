// supabase/functions/ingest-vision/index.ts
// استخراج بنية الكتاب المدرسيّ من صور الصفحات عبر Gemini Vision (gemini-2.5-flash).
// تقرأ كل صفحة (صورة PNG) من bucket التخزين العامّ lesson_pages، ترسلها منفردة
// إلى Gemini لاستخراج النصّ العربيّ الصحيح واستنتاج بنية الصفحة، وتُرجع JSON نظيفًا.
//
// المسار المختبَر الآن: mode='preview' (إرجاع JSON فقط، بلا أي كتابة في القاعدة).
// المسار mode='commit' مهيّأ لكن لا يكتب بعد — يُفعَّل بعد فحص جودة المعاينة.
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

// رابط التخزين العامّ الافتراضيّ (يُشتقّ من SUPABASE_URL إن توفّر).
const FALLBACK_SUPABASE_URL = 'https://lzfgjvafmvofwjiyvelq.supabase.co';

// حدّ أمان لعدد الصفحات في الطلب الواحد (يمنع الطلبات الضخمة بالخطأ).
const MAX_PAGES_PER_REQUEST = 200;

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

// استخراج بنية صفحة واحدة عبر Gemini Vision.
async function extractPage(
  pageNumber: number,
  bookSlug: string,
  storageBase: string,
  geminiKey: string
): Promise<PageResult> {
  const nnn = String(pageNumber).padStart(3, '0');
  const imageUrl = `${storageBase}/storage/v1/object/public/lesson_pages/${bookSlug}/page-${nnn}.png`;

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
            maxOutputTokens: 4096,
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

    // ===== التحقّق من المدخلات =====
    if (!bookSlug) return json({ error: 'book_slug مطلوب' }, 400);
    if (pageFrom === null || pageTo === null) {
      return json({ error: 'page_from و page_to مطلوبان (أرقام)' }, 400);
    }
    if (pageFrom < 1 || pageTo < pageFrom) {
      return json({ error: 'نطاق صفحات غير صالح (page_from ≥ 1 و page_to ≥ page_from)' }, 400);
    }
    const totalPages = pageTo - pageFrom + 1;
    if (totalPages > MAX_PAGES_PER_REQUEST) {
      return json(
        { error: `النطاق كبير جدًّا (${totalPages} صفحة). الحدّ ${MAX_PAGES_PER_REQUEST} في الطلب الواحد.` },
        400
      );
    }

    // ===== الأسرار =====
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || FALLBACK_SUPABASE_URL;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY غير مضبوط في الخادم' }, 500);
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط في الخادم' }, 500);

    const storageBase = supabaseUrl.replace(/\/+$/, '');

    // عميل خدميّ (service role) جاهز لمسار الكتابة (commit) لاحقًا.
    const supabase = createClient(supabaseUrl, serviceKey);

    // ===== استخراج كل صفحة على حدة (فشل صفحة لا يوقف البقيّة) =====
    const results: PageResult[] = [];
    for (let p = pageFrom; p <= pageTo; p++) {
      const r = await extractPage(p, bookSlug, storageBase, geminiKey);
      results.push(r);
    }

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    const summary = {
      book_slug: bookSlug,
      subject_id: subjectId,
      grade_id: gradeId,
      part_number: partNumber,
      page_from: pageFrom,
      page_to: pageTo,
      total: results.length,
      ok: okCount,
      failed: failCount,
    };

    // ===== mode = preview: إرجاع النتائج فقط، بلا أي كتابة =====
    if (mode === 'preview') {
      return json({ mode: 'preview', committed: false, summary, pages: results });
    }

    // ===== mode = commit: مهيّأ لكن غير مفعّل بعد (يُفعَّل بعد فحص جودة المعاينة) =====
    // العميل الخدميّ (supabase) والنتائج المطبّعة جاهزة للكتابة هنا لاحقًا.
    // لا نكتب في القاعدة الآن حفاظًا على البيانات حتى اعتماد الجودة.
    void supabase;
    return json(
      {
        mode: 'commit',
        committed: false,
        notice: 'الكتابة في القاعدة لم تُفعَّل بعد — راجع نتائج المعاينة واعتمد الجودة أولًا.',
        summary,
        pages: results,
      },
      200
    );
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
