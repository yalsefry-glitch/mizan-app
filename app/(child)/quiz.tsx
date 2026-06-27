// app/(child)/quiz.tsx
// شاشة الاختبار المصغّر: تعرض سؤالًا (من الذكاء أو احتياطيًّا)، تتحقّق
// من الإجابة، وتوجّه للمكافأة عند الصحّة. حكيم يشجّع.

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Hakeem from '../../components/Hakeem';
import type { QuizQuestion } from '../../core/ai';
import { theme } from '../../config/theme';

// سؤال احتياطي إن لم يصل سؤال من الذكاء.
const FALLBACK_QUIZ: QuizQuestion = {
  question: 'كم ناتج ٣ × ٤ ؟',
  options: ['١٠', '١٢', '٧', '١٥'],
  correctIndex: 1,
};

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ childId: string; lessonId: string; quiz: string }>();

  // محاولة قراءة سؤال الذكاء الممرّر، وإلّا الاحتياطي.
  let quiz: QuizQuestion = FALLBACK_QUIZ;
  try {
    if (params.quiz) {
      const parsed = JSON.parse(params.quiz);
      if (parsed?.question && Array.isArray(parsed?.options)) quiz = parsed;
    }
  } catch {
    quiz = FALLBACK_QUIZ;
  }

  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const choose = (index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);

    const correct = index === quiz.correctIndex;
    if (correct) {
      setTimeout(() => {
        router.replace({
          pathname: '/(child)/reward',
          params: { childId: params.childId, lessonId: params.lessonId },
        });
      }, 1100);
    } else {
      // إعادة المحاولة بعد لحظة.
      setTimeout(() => {
        setAnswered(false);
        setSelected(null);
      }, 1500);
    }
  };

  const optionStyle = (index: number) => {
    if (!answered) return s.option;
    if (index === quiz.correctIndex) return [s.option, s.optionCorrect];
    if (index === selected) return [s.option, s.optionWrong];
    return s.option;
  };

  const isCorrect = answered && selected === quiz.correctIndex;
  const isWrong = answered && selected !== quiz.correctIndex;

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Text style={s.title}>اختبار سريع</Text>

      <View style={s.hakeemSection}>
        <Hakeem mood={isCorrect ? 'happy' : 'idle'} size={100} />
        <View style={s.bubble}>
          <Text style={s.bubbleText}>
            {!answered
              ? 'فكّر جيّدًا يا بطل، أنت تقدر!'
              : isCorrect
              ? 'أحسنت! إجابة صحيحة!'
              : 'لا بأس، حاول مرّة أخرى!'}
          </Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.question}>{quiz.question}</Text>
        {quiz.options.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={optionStyle(i)}
            onPress={() => choose(i)}
            activeOpacity={0.85}
          >
            <Text style={s.optionText}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md, paddingTop: 54, paddingBottom: 30 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark, textAlign: 'center', marginBottom: 16 },
  hakeemSection: { alignItems: 'center', marginBottom: 18 },
  bubble: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 14, marginTop: 8 },
  bubbleText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.textBody, textAlign: 'center' },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: theme.spacing.md },
  question: { fontFamily: theme.fonts.heading, fontSize: 20, color: theme.colors.textDark, textAlign: 'center', marginVertical: 16 },
  option: {
    backgroundColor: '#F9FAFB',
    borderWidth: 3,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 15,
    marginBottom: 11,
    alignItems: 'center',
  },
  optionCorrect: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  optionWrong: { borderColor: theme.colors.error, backgroundColor: theme.colors.errorBg },
  optionText: { fontFamily: theme.fonts.bodyBold, fontSize: 16, color: theme.colors.textBody },
});
