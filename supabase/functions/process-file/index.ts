// supabase/functions/process-file/index.ts
// تُستدعى بعد رفع درس جديد. تقرأ الملفّ من Storage، تستخرج نصّه
// (txt مباشرة، pdf عبر unpdf)، تحفظه في content_text، وتضع status=processed.
// بيئة: Supabase Edge Functions (Deno). جاهز للـDeploy.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractText, getDocumentProxy } from 'https://esm.sh/unpdf@0.12.1';

const LESSONS_BUCKET = 'lesson-files';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { lessonId } = await req.json();
    if (!lessonId) {
      return json({ error: 'lessonId مطلوب' }, 400);
    }

    // عميل بصلاحية الخادم (service_role) — يقرأ ويكتب بتجاوز RLS.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ١) جلب سجلّ الدرس لمعرفة مسار الملفّ ونوعه.
    const { data: lesson, error: selErr } = await supabase
      .from('lessons')
      .select('id, file_path')
      .eq('id', lessonId)
      .single();
    if (selErr || !lesson) {
      return json({ error: 'الدرس غير موجود: ' + (selErr?.message || '') }, 404);
    }

    const filePath: string = lesson.file_path;
    const isPdf = filePath.toLowerCase().endsWith('.pdf');

    // ٢) تنزيل الملفّ من Storage.
    const { data: blob, error: dlErr } = await supabase.storage
      .from(LESSONS_BUCKET)
      .download(filePath);
    if (dlErr || !blob) {
      return json({ error: 'تعذّر تنزيل الملفّ: ' + (dlErr?.message || '') }, 500);
    }

    // ٣) استخراج النصّ.
    let contentText = '';
    if (isPdf) {
      const buffer = new Uint8Array(await blob.arrayBuffer());
      const pdf = await getDocumentProxy(buffer);
      const { text } = await extractText(pdf, { mergePages: true });
      contentText = (text || '').trim();
    } else {
      // txt: قراءة مباشرة.
      contentText = (await blob.text()).trim();
    }

    if (!contentText) {
      return json({ error: 'لم يُستخرَج أي نصّ من الملفّ.' }, 422);
    }

    // ٤) حفظ النصّ وتحديث الحالة.
    const { error: updErr } = await supabase
      .from('lessons')
      .update({ content_text: contentText, status: 'processed' })
      .eq('id', lessonId);
    if (updErr) {
      return json({ error: 'تعذّر حفظ النصّ: ' + updErr.message }, 500);
    }

    return json({ success: true, length: contentText.length });
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
