// supabase/functions/explain-lesson/index.ts
// تستقبل نصّ الدرس، تتّصل بنموذج ذكاء (OpenAI-compatible)، وتُرجع:
// { explanation, keywords, question, options[4], correctIndex } بصيغة JSON.
// بيئة: Supabase Edge Functions (Deno). جاهز للـDeploy.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// نقطة نهاية النموذج (OpenAI-compatible). غيّر URL/الموديل حسب مزوّدك.
const AI_BASE_URL = Deno.env.get('AI_BASE_URL') || 'https://api.openai.com/v1';
const AI_MODEL = Deno.env.get('AI_MODEL') || 'gpt-4o-mini';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lessonText, title } = await req.json();
    if (!lessonText || !String(lessonText).trim()) {
      return json({ error: 'lessonText مطلوب' }, 400);
    }

    const apiKey = Deno.env.get('OPENAI_KEY');
    if (!apiKey) {
      return json({ error: 'مفتاح الذكاء غير مضبوط في الخادم' }, 500);
    }

    // تعليمات النظام: تطلب مخرجًا JSON صارمًا بلا أي نصّ إضافي.
    const systemPrompt =
      'أنت معلّم ودود للأطفال اسمه «حكيم». مهمّتك أن تشرح الدرس بأسلوب ' +
      'مبسّط ومرح ومناسب لطفل، ثمّ تُعدّ سؤالًا واحدًا من متعدّد. ' +
      'أعِد ردّك حصريًّا بصيغة JSON صالحة دون أي نصّ قبله أو بعده، ' +
      'بالحقول التالية فقط: ' +
      '{"explanation": "شرح مبسّط مرح للطفل في ٣-٥ جمل", ' +
      '"keywords": "٣-٦ كلمات مفتاحية للبحث عن فيديو شرح بالعربية", ' +
      '"question": "سؤال واحد بسيط عن الدرس", ' +
      '"options": ["خيار","خيار","خيار","خيار"], ' +
      '"correctIndex": 0}. ' +
      'correctIndex رقم من 0 إلى 3 يشير للخيار الصحيح. ' +
      'اجعل اللغة عربية بسيطة ومشجّعة.';

    const userPrompt =
      'عنوان الدرس: ' + (title || '') + '\n\nنصّ الدرس:\n' + String(lessonText).slice(0, 6000);

    // استدعاء النموذج.
    const aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return json({ error: 'فشل اتّصال الذكاء: ' + errText }, 502);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || '{}';

    // تحليل JSON بأمان (إزالة أي أسوار ```json احتياطًا).
    let parsed: any;
    try {
      const clean = String(raw).replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return json({ error: 'ردّ الذكاء ليس JSON صالحًا' }, 502);
    }

    // التحقّق من اكتمال الحقول وضبط القيم الافتراضية.
    const result = {
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      keywords: typeof parsed.keywords === 'string' ? parsed.keywords : (title || ''),
      question: typeof parsed.question === 'string' ? parsed.question : '',
      options: Array.isArray(parsed.options) ? parsed.options.slice(0, 4) : [],
      correctIndex:
        typeof parsed.correctIndex === 'number' &&
        parsed.correctIndex >= 0 &&
        parsed.correctIndex <= 3
          ? parsed.correctIndex
          : 0,
    };

    return json(result);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
