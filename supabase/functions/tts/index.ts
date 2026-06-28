// supabase/functions/tts/index.ts
// تستقبل { text, gender } وتستدعي ElevenLabs Text-to-Speech، وتُرجع صوتًا audio/mpeg.
// بيئة: Supabase Edge Functions (Deno).
// الأسرار المطلوبة في Secrets:
//   ELEVENLABS_API_KEY      — مفتاح ElevenLabs
//   ELEVENLABS_VOICE_MALE   — معرّف الصوت الذكوري (حكيم)
//   ELEVENLABS_VOICE_FEMALE — معرّف الصوت الأنثوي
// النموذج: eleven_multilingual_v2 (يدعم العربية).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MODEL_ID = 'eleven_multilingual_v2';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, gender } = await req.json();
    if (!text || !String(text).trim()) {
      return jsonError('text مطلوب', 400);
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return jsonError('مفتاح ElevenLabs غير مضبوط في الخادم', 500);
    }

    // اختيار الصوت حسب الجنس (افتراضيًّا ذكوري — حكيم).
    const isFemale = String(gender || '').toLowerCase() === 'female';
    const voiceId = isFemale
      ? Deno.env.get('ELEVENLABS_VOICE_FEMALE')
      : Deno.env.get('ELEVENLABS_VOICE_MALE');

    if (!voiceId) {
      return jsonError('معرّف الصوت غير مضبوط في الخادم', 500);
    }

    const ttsRes = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + voiceId,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: String(text).slice(0, 5000),
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return jsonError('فشل اتّصال ElevenLabs: ' + errText, 502);
    }

    const audio = await ttsRes.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        ...corsHeaders,
        // octet-stream حتى يُرجِع supabase.functions.invoke الصوت كـ Blob ثنائي
        // (audio/mpeg يُفسَّر نصًّا فيتلف الصوت). البايتات نفسها صوت MP3.
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return jsonError(String(err?.message || err), 500);
  }
});

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
