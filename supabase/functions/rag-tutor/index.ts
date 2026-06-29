// supabase/functions/rag-tutor/index.ts
// المعلّم الحواري القائم على RAG. يخلف tutor-chat القديمة (المؤرشفة).
// التدفّق: (١) يولّد embedding لرسالة الطفل، (٢) يستعلم lesson_chunks بتشابه
// كوني مقيَّد بـ lesson_id فقط (عزل تامّ — لا يخرج خارج الدرس الحاليّ)،
// (٣) يبني السياق ويرسله لـ Gemini 2.5 Flash بتعليمات صارمة: عند الواجب،
// يوجّه ولا يعطي الحلّ النهائيّ أبدًا.
// يحافظ على نفس عقد الردّ القديم: reply, understanding, concept, lessonComplete, suggestChips.
//
// المفاتيح المطلوبة: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CHAT_MODEL = Deno.env.get('AI_MODEL') || 'gemini-2.5-flash';
const EMBED_MODEL = 'text-embedding-004';
const MATCH_COUNT = 5;

interface Turn {
  role: 'hakeem' | 'child';
  text: string;
}

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
    const lessonTitle: string = body.lessonTitle || '';
    const ageTone: string = body.ageTone || '';
    const childName: string = body.childName || 'صديقي';
    const isHomework: boolean = body.isHomework === true;
    // نصّ فيديو الدرس (اختياريّ): إن وُجد يُضاف للسياق ليجيب حكيم من الفيديو والـPDF معًا.
    const videoTranscript: string = typeof body.videoTranscript === 'string' ? body.videoTranscript : '';
    const history: Turn[] = Array.isArray(body.history) ? body.history : [];
    const childReply: string = body.childReply || body.childMessage || '';

    if (!lessonId) return json({ error: 'lessonId مطلوب' }, 400);

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY غير مضبوط في الخادم' }, 500);
    if (!supabaseUrl || !serviceKey) return json({ error: 'إعداد Supabase ناقص في الخادم' }, 500);

    const supabase = createClient(supabaseUrl, serviceKey);

    // ===== استرجاع السياق (RAG) — مقيَّد بالدرس الحاليّ فقط =====
    const query = childReply || lessonTitle || 'ابدأ الدرس';
    let context = '';
    try {
      const qEmbedding = await embed(query, geminiKey);
      const { data: matches } = await supabase.rpc('match_lesson_chunks', {
        query_embedding: qEmbedding,
        p_lesson_id: lessonId, // العزل التامّ
        match_count: MATCH_COUNT,
      });
      if (Array.isArray(matches) && matches.length > 0) {
        context = matches
          .map((m: { content: string; page_number?: number }) => {
            const pageHint = m.page_number ? ` [ص${m.page_number}]` : '';
            return '• ' + m.content + pageHint;
          })
          .join('\n');
      }
    } catch (_e) {
      // إن فشل الاسترجاع، نكمل بسياق فارغ (حكيم يعتمد على عنوان الدرس) بدل الانهيار.
      context = '';
    }

    // إن وُجد نصّ فيديو، نضمّه للسياق ليجمع حكيم بين الفيديو والمقاطع المسترجَعة.
    if (videoTranscript.trim()) {
      const vt = videoTranscript.trim().slice(0, 4000); // حدّ آمن لطول السياق
      context = context
        ? context + '\n\n[من الفيديو]\n' + vt
        : '[من الفيديو]\n' + vt;
    }

    // ===== تعليمات النظام: شخصية حكيم + قاعدة الواجب الصارمة =====
    const homeworkRule = isHomework
      ? 'تنبيه مهمّ: هذا واجب مدرسيّ. لا تعطِ الحلّ النهائيّ أبدًا. ' +
        'وجّه الطفل بأسئلة وتلميحات ليصل بنفسه، وامدح محاولته. ' +
        'إن طلب الإجابة مباشرة، اعتذر بلطف ووجّهه للخطوة التالية فقط. '
      : '';

    const systemPrompt =
      'أنت «حكيم»، بومة حكيمة ودودة تعلّم الأطفال بأسلوب المحادثة والقصة. ' +
      'اسم الطفل: ' + childName + '. ' + ageTone + ' ' +
      'اعتمد حصريًّا على «سياق الدرس» أدناه؛ لا تخترع معلومات خارجه. ' +
      homeworkRule +
      '\n\n' +
      '=== الدستور (إجباري) ===\n' +
      '١. بروتوكول الكتاب (في بداية الدرس فقط):\n' +
      '   - اسأل: "يا بطل، كتاب ' + (subject || 'المادة') + ' معك؟"\n' +
      '   - انتظر إجابته ولا تكمل في نفس الرد.\n' +
      '٢. مسار المزامنة (إن قال نعم/إي/معي):\n' +
      '   - قل: "ممتاز! افتح صفحة [رقم الصفحة من السياق أدناه — ابحث عن [ص...]]، وقل لي متى وصلت."\n' +
      '   - انتظر تأكيده قبل شرح أي شيء.\n' +
      '   - بعد تأكيده، ابدأ الشرح مع ربط كل معلومة برقم الصفحة.\n' +
      '٣. مسار الطوارئ (إن قال لا/ما معي/ضايع):\n' +
      '   - قل: "ولا يهمّك يا بطل! بشرح لك وكأن الكتاب قدّامك."\n' +
      '   - اشرح بوصف بصري تفصيلي دون ذكر أرقام صفحات.\n' +
      '٤. قاعدة الخطوة الواحدة (دائمًا):\n' +
      '   - معلومة واحدة أو فكرة واحدة، ثم سؤال تحقّق بسيط، ثم انتظر.\n' +
      '   - لا تشرح خطوتين في رد واحد أبدًا.\n' +
      '\n' +
      'قواعد جوهرية: ' +
      '(١) لا تستخدم أبدًا أسلوب «صحيح/خطأ» المدرسي. ' +
      '(٢) إذا لم يفهم الطفل، أعِد الشرح بزاوية جديدة بروح مشجّعة. ' +
      '(٣) احكِ بقصص وأمثلة من عالم الطفل (ألعاب، حيوانات، حلوى). ' +
      '(٤) جُمَل قصيرة بسيطة مناسبة للنطق الصوتي. ' +
      '(٥) تفاعل مع ما يقوله الطفل فعليًّا. ' +
      '\n' +
      'الدرس الحالي: «' + lessonTitle + '». ' +
      'سياق الدرس (مقاطع مسترجَعة):\n' + (context || '(لا يوجد سياق مسترجَع)') + '\n' +
      'أعِد ردّك حصريًّا بصيغة JSON صالحة دون أي نصّ خارجها، بالحقول: ' +
      '{"reply": "ما يقوله حكيم الآن (سيُنطق صوتيًّا، جملتان أو ثلاث)", ' +
      '"understanding": "good" أو "needs_review" أو "starting", ' +
      '"concept": "المفهوم الفرعي الحاليّ", ' +
      '"lessonComplete": true أو false, ' +
      '"suggestChips": ["ردّ مقترح ١","ردّ مقترح ٢"]}. ' +
      'lessonComplete=true فقط حين يُتقن الطفل المفهوم الأساسي بعد حوار كافٍ.';

    // ===== بناء محتويات المحادثة (صيغة Gemini) =====
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const turn of history) {
      contents.push({
        role: turn.role === 'hakeem' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      });
    }
    if (childReply) {
      contents.push({ role: 'user', parts: [{ text: childReply }] });
    } else if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'ابدأ الدرس معي يا حكيم!' }] });
    }

    const aiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        CHAT_MODEL +
        ':generateContent?key=' +
        geminiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({ error: 'فشل اتّصال الذكاء', detail: errText }, 502);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: any;
    try {
      const clean = String(raw).replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return json({
        reply: String(raw).slice(0, 500),
        understanding: 'starting',
        concept: '',
        lessonComplete: false,
        suggestChips: [],
      });
    }

    const result = {
      reply: typeof parsed.reply === 'string' ? parsed.reply : 'هيّا نتعلّم معًا!',
      understanding: ['good', 'needs_review', 'starting'].includes(parsed.understanding)
        ? parsed.understanding
        : 'starting',
      concept: typeof parsed.concept === 'string' ? parsed.concept : '',
      lessonComplete: parsed.lessonComplete === true,
      suggestChips: Array.isArray(parsed.suggestChips) ? parsed.suggestChips.slice(0, 3) : [],
    };

    return json(result);
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
