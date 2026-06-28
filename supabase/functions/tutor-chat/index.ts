// supabase/functions/tutor-chat/index.ts
// عقل المعلّم الحواري «حكيم». يدير محادثة تعليمية متعدّدة الجولات:
// - يستقبل سجلّ المحادثة الكامل + ردّ الطفل الأخير + سياق الدرس وعمره.
// - يحلّل فهم الطفل عبر النموذج دون أسلوب صح/خطأ المدرسي.
// - يقرّر مسار الشرح التالي: يتقدّم إن فهم، أو يعيد بزاوية جديدة إن تردّد.
// - يُرجع: ردّ حكيم (نصّ للنطق) + حالة الفهم + هل اكتمل الدرس.
//
// المفتاح في السرّ GEMINI_API_KEY. النموذج gemini-2.0-flash-001.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AI_MODEL = Deno.env.get('AI_MODEL') || 'gemini-2.0-flash-001';

interface Turn {
  role: 'hakeem' | 'child';
  text: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const lessonText: string = body.lessonText || '';
    const lessonTitle: string = body.lessonTitle || '';
    const ageTone: string = body.ageTone || '';
    const childName: string = body.childName || 'صديقي';
    const history: Turn[] = Array.isArray(body.history) ? body.history : [];
    const childReply: string = body.childReply || '';

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ error: 'مفتاح الذكاء غير مضبوط في الخادم' }, 500);
    }

    // تعليمات النظام: تحدّد شخصية حكيم وفلسفة الحوار (لا صح/خطأ).
    const systemPrompt =
      'أنت «حكيم»، بومة حكيمة ودودة تعلّم الأطفال بأسلوب المحادثة والقصة. ' +
      'اسم الطفل: ' + childName + '. ' + ageTone + ' ' +
      'قواعد جوهرية: ' +
      '(١) لا تستخدم أبدًا أسلوب «صحيح/خطأ» المدرسي. لا تقل «إجابة خاطئة». ' +
      '(٢) إذا لم يفهم الطفل، أعِد الشرح بزاوية جديدة (تشبيه آخر، مثال أبسط) ' +
      'بروح مشجّعة، كأنّكما تكتشفان معًا. ' +
      '(٣) احكِ بقصص وأمثلة من عالم الطفل (ألعاب، حيوانات، حلوى). ' +
      '(٤) جُمَل قصيرة بسيطة مناسبة للنطق الصوتي (سيُنطق ردّك بصوت مسموع). ' +
      '(٥) تفاعل مع ما يقوله الطفل فعليًّا، لا بردود جاهزة. ' +
      'الدرس الحالي: «' + lessonTitle + '». محتواه المرجعي: ' + lessonText.slice(0, 3000) + '. ' +
      'أعِد ردّك حصريًّا بصيغة JSON صالحة دون أي نصّ خارجها، بالحقول: ' +
      '{"reply": "ما يقوله حكيم للطفل الآن (سيُنطق صوتيًّا، جملتان أو ثلاث)", ' +
      '"understanding": "good" أو "needs_review" أو "starting", ' +
      '"concept": "المفهوم الفرعي الذي يعالجه حكيم الآن", ' +
      '"lessonComplete": true أو false, ' +
      '"suggestChips": ["ردّ مقترح ١","ردّ مقترح ٢"]}. ' +
      'suggestChips: ردود قصيرة جدًّا (كلمة أو كلمتان) يمكن للطفل اختيارها بدل الكتابة. ' +
      'lessonComplete=true فقط حين يُتقن الطفل المفهوم الأساسي بعد حوار كافٍ.';

    // بناء محتويات المحادثة من السجلّ (صيغة Gemini: role + parts[]).
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const turn of history) {
      contents.push({
        role: turn.role === 'hakeem' ? 'model' : 'user',
        parts: [{ text: turn.text }],
      });
    }
    // ردّ الطفل الأخير (إن وُجد). إن كانت بداية الدرس، نطلب من حكيم البدء.
    if (childReply) {
      contents.push({ role: 'user', parts: [{ text: childReply }] });
    } else if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'ابدأ الدرس معي يا حكيم!' }] });
    }

    // استدعاء Gemini generateContent — المفتاح في رابط الطلب كـ query parameter.
    const aiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        AI_MODEL + ':generateContent?key=' + apiKey,
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
    // ردّ Gemini: النصّ في candidates[0].content.parts[0].text.
    const raw = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: any;
    try {
      const clean = String(raw).replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // إن لم يكن JSON، نستخدم النصّ الخام كردّ حكيم (أمان).
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
      understanding:
        ['good', 'needs_review', 'starting'].includes(parsed.understanding)
          ? parsed.understanding
          : 'starting',
      concept: typeof parsed.concept === 'string' ? parsed.concept : '',
      lessonComplete: parsed.lessonComplete === true,
      suggestChips: Array.isArray(parsed.suggestChips)
        ? parsed.suggestChips.slice(0, 3)
        : [],
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
