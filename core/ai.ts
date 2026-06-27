// core/ai.ts
// واجهة استدعاء دوال الخادم (Edge Functions) من التطبيق:
// - explainLesson: يحوّل نصّ الدرس إلى شرح + سؤال اختبار.
// - searchVideo: يجد فيديو يوتيوب تعليميًّا آمنًا للموضوع.
// تتعامل مع الأخطاء بسلاسة (حالة بديلة) دون انهيار الواجهة.

import { supabase } from './supabase';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface LessonExplanation {
  explanation: string;
  keywords: string[];
  quiz: QuizQuestion | null;
}

/**
 * طلب شرح درس من دالّة explain-lesson، مع نبرة مناسبة لعمر الطفل.
 */
export async function explainLesson(
  lessonText: string,
  hakeemTone: string
): Promise<LessonExplanation | null> {
  try {
    const { data, error } = await supabase.functions.invoke('explain-lesson', {
      body: { lessonText, tone: hakeemTone },
    });
    if (error || !data) return null;

    return {
      explanation: data.explanation ?? '',
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      quiz:
        data.question && Array.isArray(data.options)
          ? {
              question: data.question,
              options: data.options,
              correctIndex: data.correctIndex ?? 0,
            }
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * البحث عن فيديو تعليمي آمن (safeSearch) لموضوع الدرس.
 * تُرجع معرّف الفيديو لعرضه في مشغّل يوتيوب المضمّن.
 */
export async function searchVideo(query: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('youtube-search', {
      body: { query },
    });
    if (error || !data) return null;
    return data.videoId ?? null;
  } catch {
    return null;
  }
}
