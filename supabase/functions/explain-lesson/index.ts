// supabase/functions/explain-lesson/index.ts
// تستقبل نصّ الدرس، تتّصل بنموذج Gemini 2.0 Flash، وتُرجع:
// { explanation, keywords, question, options[4], correctIndex } بصيغة JSON.
// بيئة: Supabase Edge Functions (Deno). يقرأ المفتاح من GEMINI_API_KEY.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// نموذج Gemini (سريع واقتصادي ومناسب للأطفال).
const AI_MODEL = Deno.env.get('AI_MODEL') || 'gemini-2.0-flash-001';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lessonText, title } = await req.json();
    if (!lessonText || !String(lessonText).trim()) {
      return json({ error: 'lessonText مطلوب' }, 400);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return json({ error: 'مفتاح الذكاء غير مضبوط في الخادم' }, 500);
    }

    const systemPrompt =
      'أنت معلّم ودود للأطفال اسمه «حكيم». اشرح الدرس بأسلوب مبسّط ' +
      'ومرح مناسب لطفل، ثمّ أعِدّ سؤالًا واحدًا من متعدّد. ' +
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

    // استدعاء Gemini generateContent — المفتاح في رابط الطلب كـ query parameter.
    const aiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' +
        AI_MODEL + ':generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
      return json({ error: 'ردّ الذكاء ليس JSON صالحًا', raw }, 502);
    }

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
