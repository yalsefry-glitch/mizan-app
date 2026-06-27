// app/(child)/reward.tsx
// شاشة المكافأة بعد اجتياز الاختبار: تمنح الجواهر، تسجّل نشاط اليوم
// (يحدّث السلسلة وطقس الكوكب)، وتحتفل مع حكيم. ثمّ تعود لعالم الطفل.

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Hakeem from '../../components/Hakeem';
import { awardGems } from '../../core/economy';
import { recordActivity } from '../../core/streaks';
import { theme } from '../../config/theme';

const GEMS_PER_LESSON = 50;

export default function RewardScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const [streakDays, setStreakDays] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!childId) {
        setDone(true);
        return;
      }
      // منح الجواهر + تسجيل النشاط (يحدّث السلسلة والطقس).
      await awardGems(childId, GEMS_PER_LESSON, 'إكمال درس');
      const streak = await recordActivity(childId);
      setStreakDays(streak.current);
      setDone(true);
    })();
  }, [childId]);

  return (
    <View style={s.container}>
      <Hakeem mood="happy" size={140} />

      <Text style={s.gem}>💎</Text>
      <Text style={s.title}>رائع يا بطل!</Text>

      <View style={s.rewardCard}>
        <Text style={s.rewardLabel}>ربحت</Text>
        <Text style={s.rewardAmount}>+{GEMS_PER_LESSON} 💎</Text>
      </View>

      {done && streakDays > 0 && (
        <Text style={s.streakText}>🔥 سلسلتك الآن {streakDays} {streakDays === 1 ? 'يوم' : 'أيام'}!</Text>
      )}

      <TouchableOpacity
        style={s.btn}
        onPress={() => router.replace({ pathname: '/(child)/world', params: { childId } })}
      >
        <Text style={s.btnText}>طوّر كوكبك بالجواهر</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 12,
  },
  gem: { fontSize: 64 },
  title: { fontFamily: theme.fonts.heading, fontSize: 26, color: theme.colors.textDark },
  rewardCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  rewardLabel: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted },
  rewardAmount: { fontFamily: theme.fonts.heading, fontSize: 28, color: theme.colors.gem },
  streakText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.streak, marginTop: 4 },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 10,
  },
  btnText: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.white },
});
