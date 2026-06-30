// supabase/functions/ingest-vision/index.ts
// استخراج بنية الكتاب المدرسي من صور الصفحات عبر Gemini Vision (gemini-2.5-flash).
// منهجية 2026: فصل كامل في استدعاء واحد (context-window كبير) — Gemini يحدد بداية/نهاية كل درس.
//
// وضعان:
//   mode='preview' (افتراضي): يُرجع مصفوفة JSON من Gemini فقط، بلا كتابة.
//   mode='commit': يكتب lessons + lesson_chunks مع embeddings، upsert idempotent.
//
// المفاتيح المطلوبة: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VISION_MODEL = 'gemini-2.5-flash';
const EMBED_MODEL = 'gemini-embedding-001';
const FALLBACK_SUPABASE_URL = 'https://lzfgjvafmvofwjiyvelq.supabase.co';

// التعليمات الصارمة لـGemini (few-shot، عربي).
const SYSTEM_PROMPT = `أنت محلل مناهج تعليمية سعودية خبير. سأعطيك سياقاً متصلاً لفصل كامل من كتاب منهج عين السعودي (عدة صفحات متتالية، كل صورة يسبقها "صورة الصفحة N:").

مهمتك:
1. حدّد بداية ونهاية كل درس بنفسك (الدرس قد يمتد صفحتين أو أكثر: صفحة الطالب + صفحة المعلم لنفس الدرس تُدمج في عنصر واحد بنص مدمج).
2. صنّف كل عنصر إلى: lesson / test_mid / test_chapter / test_cumulative / intro / cover / teacher / other.
3. استخرج النص العربي الكامل المنظف لكل عنصر (دمج نص كل صفحاته).

أعد مصفوفة JSON نقية فقط، بلا markdown، بلا نص قبل أو بعد. كل عنصر:
{
  "item_type": "lesson|test_mid|test_chapter|test_cumulative|intro|cover|teacher|other",
  "chapter_number": <رقم أو null>,
  "chapter_title": "<نص أو فارغ>",
  "lesson_title": "<نص أو فارغ>",
  "page_start": <رقم>,
  "page_end": <رقم>,
  "full_text": "<النص العربي الكامل المدمج المنظف>"
}

مثال تخيلي (فصل 3، صفحات 15-18):
[
  {
    "item_type": "intro",
    "chapter_number": 3,
    "chapter_title": "الجمع والطرح",
    "lesson_title": "تهيئة",
    "page_start": 15,
    "page_end": 15,
    "full_text": "تهيئة الفصل الثالث: الجمع والطرح..."
  },
  {
    "item_type": "lesson",
    "chapter_number": 3,
    "chapter_title": "الجمع والطرح",
    "lesson_title": "الجمع بإعادة التجميع",
    "page_start": 16,
    "page_end": 17,
    "full_text": "الجمع بإعادة التجميع. مثال: 25 + 18 = ... (صفحة طالب) ... إرشادات للمعلم: ... (صفحة معلم)"
  },
  {
    "item_type": "test_chapter",
    "chapter_number": 3,
    "chapter_title": "الجمع والطرح",
    "lesson_title": "اختبار الفصل 3",
    "page_start": 18,
    "page_end": 18,
    "full_text": "اختبار الفصل الثالث. سؤال 1: ..."
  }
]

ملاحظات:
- cover/teacher/other نتجاهلها لاحقاً (لا تُكتب في القاعدة).
- lesson_title نظيف (لا رموز درس مثل "3-2"، لا أرقام صفحات).
- page_start و page_end أرقام صحيحة (من رقم الصفحة المكتوب على الصورة).
- full_text يدمج نص كل صفحات العنصر، منظف، متصل.

أعد المصفوفة JSON فوراً.`;

// ===== التضمين (768 بُعداً) =====
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

// تحويل بايتات إلى base64.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// تنظيف ردّ Gemini دفاعياً (إزالة ```json، اقتطاع [ ] الخارجية).
function safeParseArray(text: string): { value: any[] | null; cleaned: string } {
  let cleaned = (text || '').trim();
  // إزالة أسوار markdown.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  }
  // اقتطاع أول مصفوفة JSON كاملة.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return { value: parsed, cleaned };
    return { value: null, cleaned };
  } catch {
    return { value: null, cleaned };
  }
}

// تطبيع رقم.
function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// بناء رابط صورة الصفحة (page-NNN.png).
function buildImageUrl(storageBase: string, bookSlug: string, pageNumber: number): string {
  const nnn = String(pageNumber).padStart(3, '0');
  return `${storageBase}/storage/v1/object/public/lesson_pages/${bookSlug}/page-${nnn}.png`;
}

// تنظيف عنوان الدرس: يزيل رمز درس بادئ "1-1" ورقم صفحة منفصل ملحق بنهاية العنوان.
// لا يقص الأرقام التي جزء من العنوان (مثل "الأعداد ١٨، ١٩، ٢٠" تبقى كما هي).
function cleanTitle(s: string): string {
  let t = (s || '').trim();
  // رمز درس بادئ: "1-1" أو "٣-٢".
  t = t.replace(/^[\d٠-٩]+\s*[-–−]\s*[\d٠-٩]+\s*/, '');
  // رقم صفحة ملحق منفصل بنهاية العنوان (رقم واحد فقط بعد مسافة، ليس ضمن سلسلة أعداد).
  // نتحقق: إن كان قبل الرقم الأخير فاصلة/واو، فهو ضمن سلسلة أعداد، لا نحذفه.
  // مثال: "أحل المسألة 13" ← نحذف 13، "الأعداد ١٨، ١٩" ← لا نحذف.
  if (!/[،,و]\s*[\d٠-٩]+\s*$/.test(t)) {
    // لا توجد فاصلة/واو قبل الرقم الأخير → رقم صفحة منفصل.
    t = t.replace(/\s+[\d٠-٩]+\s*$/, '');
  }
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

// أنواع قابلة للكتابة.
const WRITABLE_TYPES = ['lesson', 'intro', 'test_mid', 'test_chapter', 'test_cumulative'];

// بنية عنصر مُرجع من Gemini.
interface GeminiItem {
  item_type: string;
  chapter_number?: number | null;
  chapter_title?: string;
  lesson_title?: string;
  page_start: number;
  page_end: number;
  full_text: string;
}

// استدعاء Gemini بفصل كامل.
async function analyzeChapter(
  pageFrom: number,
  pageTo: number,
  bookSlug: string,
  storageBase: string,
  geminiKey: string
): Promise<{ ok: boolean; items?: GeminiItem[]; error?: string; raw?: string }> {
  try {
    // (1) تحميل كل الصور.
    const parts: any[] = [];
    for (let p = pageFrom; p <= pageTo; p++) {
      const imageUrl = buildImageUrl(storageBase, bookSlug, p);
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return { ok: false, error: `فشل تحميل صفحة ${p} (HTTP ${imgRes.status})` };
      }
      const bytes = new Uint8Array(await imgRes.arrayBuffer());
      if (bytes.length === 0) {
        return { ok: false, error: `صفحة ${p} فارغة` };
      }
      const base64 = bytesToBase64(bytes);

      // نضع نصاً يسبق كل صورة ليربط Gemini الصورة برقمها.
      parts.push({ text: `صورة الصفحة ${p}:` });
      parts.push({ inlineData: { mimeType: 'image/png', data: base64 } });
    }

    // (2) إرسال استدعاء واحد إلى Gemini.
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  item_type: {
                    type: 'string',
                    enum: ['lesson', 'test_mid', 'test_chapter', 'test_cumulative', 'intro', 'cover', 'teacher', 'other'],
                  },
                  chapter_number: {
                    type: 'integer',
                    nullable: true,
                  },
                  chapter_title: {
                    type: 'string',
                  },
                  lesson_title: {
                    type: 'string',
                    description: 'العنوان الكامل للدرس كما يظهر في ترويسة الصفحة، دون قص أي أرقام أو كلمات جزء من العنوان (مثال: "الأعداد ١٨، ١٩، ٢٠" يُرجع كاملاً)',
                  },
                  page_start: {
                    type: 'integer',
                  },
                  page_end: {
                    type: 'integer',
                  },
                  full_text: {
                    type: 'string',
                  },
                },
                required: ['item_type', 'page_start', 'page_end', 'full_text'],
              },
            },
          },
        }),
      }
    );

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return { ok: false, error: `فشل Gemini (HTTP ${aiRes.status}): ${detail.slice(0, 300)}` };
    }

    const data = await aiRes.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // (3) تحليل المصفوفة بأمان.
    const { value, cleaned } = safeParseArray(text);
    if (!value || !Array.isArray(value)) {
      return { ok: false, error: 'ردّ Gemini ليس مصفوفة JSON', raw: cleaned.slice(0, 2000) };
    }

    // (4) تطبيع العناصر.
    const items: GeminiItem[] = [];
    for (const raw of value) {
      if (typeof raw !== 'object' || !raw) continue;
      const itemType =
        typeof raw.item_type === 'string' && WRITABLE_TYPES.includes(raw.item_type)
          ? raw.item_type
          : 'other';
      if (itemType === 'other') continue; // نتجاهل cover/teacher/other.

      const pageStart = toNumberOrNull(raw.page_start);
      const pageEnd = toNumberOrNull(raw.page_end);
      const fullText = typeof raw.full_text === 'string' ? raw.full_text.trim() : '';
      if (pageStart === null || pageEnd === null || !fullText) continue;

      items.push({
        item_type: itemType,
        chapter_number: toNumberOrNull(raw.chapter_number),
        chapter_title: typeof raw.chapter_title === 'string' ? raw.chapter_title.trim() : '',
        lesson_title: typeof raw.lesson_title === 'string' ? cleanTitle(raw.lesson_title) : '',
        page_start: pageStart,
        page_end: pageEnd,
        full_text: fullText,
      });
    }

    return { ok: true, items };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const subjectId: string = body.subject_id || '';
    const partNumber = toNumberOrNull(body.part_number);
    const bookSlug: string = (body.book_slug || '').trim();
    const pageFrom = toNumberOrNull(body.page_from);
    const pageTo = toNumberOrNull(body.page_to);
    const mode: string = body.mode === 'commit' ? 'commit' : 'preview';
    const overrideChapter = toNumberOrNull(body.chapter_number); // رقم فصل حتمي (يُشتق من نطاق الصفحات)

    // التحقق.
    if (!bookSlug) return json({ error: 'book_slug مطلوب' }, 400);
    if (pageFrom === null || pageTo === null) {
      return json({ error: 'page_from و page_to مطلوبان' }, 400);
    }
    if (pageFrom < 1 || pageTo < pageFrom) {
      return json({ error: 'نطاق صفحات غير صالح' }, 400);
    }

    // الأسرار.
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || FALLBACK_SUPABASE_URL;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY غير مضبوط' }, 500);
    if (!serviceKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY غير مضبوط' }, 500);

    const storageBase = supabaseUrl.replace(/\/+$/, '');
    const supabase = createClient(supabaseUrl, serviceKey);

    // ===== استدعاء Gemini (فصل كامل) =====
    const result = await analyzeChapter(pageFrom, pageTo, bookSlug, storageBase, geminiKey);
    if (!result.ok || !result.items) {
      return json(
        {
          mode,
          committed: false,
          error: result.error || 'فشل التحليل',
          raw: result.raw,
        },
        500
      );
    }

    const items = result.items;

    // ===== وضع المعاينة: إرجاع JSON فقط =====
    if (mode === 'preview') {
      return json({
        mode: 'preview',
        committed: false,
        summary: {
          book_slug: bookSlug,
          subject_id: subjectId,
          part_number: partNumber,
          page_from: pageFrom,
          page_to: pageTo,
          total_items: items.length,
        },
        items,
      });
    }

    // ===== وضع الكتابة (commit) =====
    if (!subjectId) return json({ error: 'subject_id مطلوب في وضع commit' }, 400);
    if (partNumber === null) return json({ error: 'part_number مطلوب في وضع commit' }, 400);

    let lessonsWritten = 0;
    let chunksWritten = 0;
    const itemReports: any[] = [];

    for (const item of items) {
      try {
        // (1) اشتقاق رقم الفصل: إن مُرّر chapter_number في الطلب، يُستخدم حتميًّا (نتجاهل Gemini).
        // وإلّا نستخدم ما أرجعه Gemini كاحتياط.
        const finalChapter = overrideChapter !== null ? overrideChapter : item.chapter_number;

        // (2) عنوان نهائي.
        const title =
          item.lesson_title ||
          (item.item_type === 'intro'
            ? finalChapter
              ? `تهيئة الفصل ${finalChapter}`
              : 'تهيئة'
            : item.item_type === 'test_mid'
            ? 'اختبار منتصف الفصل'
            : item.item_type === 'test_chapter'
            ? finalChapter
              ? `اختبار الفصل ${finalChapter}`
              : 'اختبار الفصل'
            : item.item_type === 'test_cumulative'
            ? 'اختبار تراكمي'
            : 'عنصر');

        // (3) upsert الدرس (idempotent).
        const { data: newLesson, error: upErr } = await supabase
          .from('lessons')
          .upsert(
            {
              subject_id: subjectId,
              title,
              part_number: partNumber,
              chapter_number: finalChapter,
              chapter_title: item.chapter_title,
              lesson_type: item.item_type,
              lesson_order: item.page_start,
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
            title,
            lesson_type: item.item_type,
            page_start: item.page_start,
            page_end: item.page_end,
            ok: false,
            error: upErr?.message || 'فشل إنشاء الدرس',
          });
          continue;
        }

        const lessonId = newLesson.id;
        lessonsWritten++;

        // (3) حذف chunks القديمة (idempotent).
        await supabase
          .from('lesson_chunks')
          .delete()
          .eq('lesson_id', lessonId)
          .gte('page_number', item.page_start)
          .lte('page_number', item.page_end);

        // (4) كتابة chunks: مقطع لكل صفحة (page_start..page_end).
        // الصفحة الأولى تحمل full_text + embedding، الباقي فارغة لكن page_image_url موجود.
        const chunkErrors: string[] = [];
        let itemChunks = 0;

        // توليد embedding مرة واحدة للنص الكامل (يُستخدم للصفحة الأولى فقط).
        let embedding: number[] | null = null;
        if (item.full_text.trim()) {
          try {
            embedding = await embed(item.full_text, geminiKey);
          } catch (e: any) {
            chunkErrors.push(`embedding: ${String(e?.message || e)}`);
          }
        }

        // إدراج chunk لكل صفحة في النطاق.
        for (let pageNum = item.page_start; pageNum <= item.page_end; pageNum++) {
          const chunkIndex = pageNum - item.page_start;
          const isFirstPage = pageNum === item.page_start;
          const imageUrl = buildImageUrl(storageBase, bookSlug, pageNum);

          try {
            const { error: chErr } = await supabase.from('lesson_chunks').insert({
              lesson_id: lessonId,
              subject: subjectId,
              chunk_index: chunkIndex,
              content: isFirstPage ? item.full_text : '', // النص في الأولى فقط
              page_number: pageNum,
              part_number: partNumber,
              page_image_url: imageUrl,
              embedding: isFirstPage && embedding ? embedding : null, // embedding للأولى فقط
            });

            if (chErr) {
              chunkErrors.push(`صفحة ${pageNum}: ${chErr.message}`);
            } else {
              itemChunks++;
              chunksWritten++;
            }
          } catch (e: any) {
            chunkErrors.push(`صفحة ${pageNum}: ${String(e?.message || e)}`);
          }
        }

        itemReports.push({
          title,
          lesson_type: item.item_type,
          chapter_number: item.chapter_number,
          page_start: item.page_start,
          page_end: item.page_end,
          ok: true,
          chunks_written: itemChunks,
          chunk_errors: chunkErrors,
        });
      } catch (e: any) {
        itemReports.push({
          title: item.lesson_title || item.item_type,
          lesson_type: item.item_type,
          page_start: item.page_start,
          page_end: item.page_end,
          ok: false,
          error: String(e?.message || e),
        });
      }
    }

    return json({
      mode: 'commit',
      committed: true,
      summary: {
        book_slug: bookSlug,
        subject_id: subjectId,
        part_number: partNumber,
        page_from: pageFrom,
        page_to: pageTo,
        lessons_written: lessonsWritten,
        chunks_written: chunksWritten,
      },
      items: itemReports,
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
