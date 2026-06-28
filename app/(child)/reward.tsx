// app/(child)/reward.tsx
// شاشة المكافأة: الطفل يختار واحدة من أربع ألعاب تفاعلية (Skia + Reanimated)،
// يلعبها (٣٠-٦٠ ثانية)، فيكسب جواهر ١-٥ حسب أدائه (لا صح/خطأ). عند الانتهاء:
// نثار احتفالي بـ Skia، منح الجواهر عبر economy، وزرّ العودة للعالم.
// كل شيء مرسوم بـ Skia — لا أصول فنية ثابتة.

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Canvas,
  Path,
  Circle,
  Line,
  Group,
  vec,
} from '@shopify/react-native-skia';
import Hakeem from '../../components/Hakeem';
import Confetti from '../../components/games/Confetti';
import DrawGame from '../../components/games/DrawGame';
import MirrorGame from '../../components/games/MirrorGame';
import PulseGame from '../../components/games/PulseGame';
import RotateGame from '../../components/games/RotateGame';
import { buildPath } from '../../components/games/geometry';
import type { GameId } from '../../components/games/types';
import { awardGems } from '../../core/economy';
import { recordActivity } from '../../core/streaks';
import { theme } from '../../config/theme';

type Phase = 'select' | 'play' | 'done';

interface GameMeta {
  id: GameId;
  title: string;
  desc: string;
}

const GAMES: GameMeta[] = [
  { id: 'draw', title: 'الرسم الحيّ', desc: 'أكمل مسار حكيم بإصبعك' },
  { id: 'mirror', title: 'المرآة', desc: 'اعكس شكل حكيم على اليمين' },
  { id: 'pulse', title: 'النبضة', desc: 'المس بإيقاع الضرب' },
  { id: 'rotate', title: 'البُعد الثالث', desc: 'دوّر الصندوق وجد الجواب' },
];

// رسم مصغّر لكل لعبة (Skia) داخل بطاقة الاختيار.
function GamePreview({ id, size }: { id: GameId; size: number }) {
  const c = size / 2;
  if (id === 'draw') {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = size * 0.12 + size * 0.76 * (i / 24);
      const y = c + size * 0.18 * Math.sin((i / 24) * Math.PI * 2);
      pts.push({ x, y });
    }
    return (
      <Canvas style={{ width: size, height: size }}>
        <Path path={buildPath(pts)} style="stroke" strokeWidth={5} strokeCap="round" color={theme.colors.primary} />
      </Canvas>
    );
  }
  if (id === 'mirror') {
    const left = [
      { x: size * 0.14, y: c + size * 0.2 },
      { x: size * 0.32, y: c - size * 0.2 },
      { x: size * 0.46, y: c + size * 0.12 },
    ];
    const right = left.map((p) => ({ x: size - p.x, y: p.y }));
    return (
      <Canvas style={{ width: size, height: size }}>
        <Line p1={vec(c, size * 0.12)} p2={vec(c, size * 0.88)} style="stroke" strokeWidth={2} color={theme.colors.border} />
        <Path path={buildPath(left)} style="stroke" strokeWidth={5} strokeCap="round" color={theme.colors.primary} />
        <Path path={buildPath(right)} style="stroke" strokeWidth={5} strokeCap="round" color={theme.colors.primaryLight} />
      </Canvas>
    );
  }
  if (id === 'pulse') {
    return (
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={c} cy={c} r={size * 0.34} color={theme.colors.gem} opacity={0.18} />
        <Circle cx={c} cy={c} r={size * 0.22} color={theme.colors.gem} opacity={0.4} />
        <Circle cx={c} cy={c} r={size * 0.12} color={theme.colors.primaryDark} />
      </Canvas>
    );
  }
  // rotate — مكعّب سلكيّ مبسّط.
  const o = size * 0.12;
  const a = size * 0.24;
  const b = size * 0.66;
  const front = [
    { x: a, y: a + o },
    { x: b, y: a + o },
    { x: b, y: b + o },
    { x: a, y: b + o },
  ];
  const back = front.map((p) => ({ x: p.x + o, y: p.y - o }));
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group>
        <Path path={buildPath([...back, back[0]])} style="stroke" strokeWidth={3} color={theme.colors.primaryLight} />
        <Path path={buildPath([...front, front[0]])} style="stroke" strokeWidth={4} color={theme.colors.primary} />
        {front.map((p, i) => (
          <Line key={i} p1={vec(p.x, p.y)} p2={vec(back[i].x, back[i].y)} style="stroke" strokeWidth={2} color={theme.colors.primaryDark} />
        ))}
      </Group>
    </Canvas>
  );
}

export default function RewardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const [phase, setPhase] = useState<Phase>('select');
  const [game, setGame] = useState<GameId | null>(null);
  const [gemsEarned, setGemsEarned] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  // تسجيل نشاط اليوم (يحدّث السلسلة والطقس) عند فتح الشاشة.
  useEffect(() => {
    (async () => {
      if (!childId) return;
      try {
        const streak = await recordActivity(childId);
        setStreakDays(streak.current);
      } catch {
        // نتجاهل بصمت — اللعب لا يتوقّف على السلسلة.
      }
    })();
  }, [childId]);

  // عند انتهاء اللعبة: منح الجواهر والانتقال لشاشة الاحتفال.
  const handleFinish = async (gems: number) => {
    setGemsEarned(gems);
    setPhase('done');
    if (childId) {
      try {
        await awardGems(childId, gems, 'لعبة المكافأة');
      } catch {
        // نتجاهل بصمت — الجواهر تُعرض، والمزامنة تُعاد لاحقًا.
      }
    }
  };

  // أبعاد منطقة اللعب.
  const headerH = insets.top + 52;
  const gameW = width;
  const gameH = Math.max(260, height - headerH - insets.bottom - 16);

  // ===== شاشة الاحتفال =====
  if (phase === 'done') {
    return (
      <View style={[s.container, { paddingTop: insets.top + 20 }]}>
        <Confetti width={width} height={height} />
        <Hakeem mood="happy" size={130} />
        <Text style={s.title}>رائع يا بطل!</Text>
        <View style={s.rewardCard}>
          <Text style={s.rewardLabel}>كسبت</Text>
          <Text style={s.rewardAmount}>+{gemsEarned} 💎</Text>
        </View>
        {streakDays > 0 && (
          <Text style={s.streakText}>
            🔥 سلسلتك الآن {streakDays} {streakDays === 1 ? 'يوم' : 'أيام'}!
          </Text>
        )}
        <TouchableOpacity
          style={s.btn}
          onPress={() => router.replace({ pathname: '/(child)/world', params: { childId } })}
        >
          <Text style={s.btnText}>العودة للعالم</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===== شاشة اللعب =====
  if (phase === 'play' && game) {
    return (
      <View style={[s.flex, { paddingTop: insets.top }]}>
        <View style={s.playHeader}>
          <TouchableOpacity
            onPress={() => {
              setGame(null);
              setPhase('select');
            }}
            style={s.backBtn}
          >
            <Text style={s.backIcon}>↩</Text>
          </TouchableOpacity>
          <Text style={s.playTitle}>{GAMES.find((g) => g.id === game)?.title}</Text>
          <View style={s.backBtn} />
        </View>
        <View style={s.gameArea}>
          {game === 'draw' && <DrawGame width={gameW} height={gameH} onFinish={handleFinish} />}
          {game === 'mirror' && <MirrorGame width={gameW} height={gameH} onFinish={handleFinish} />}
          {game === 'pulse' && <PulseGame width={gameW} height={gameH} onFinish={handleFinish} />}
          {game === 'rotate' && <RotateGame width={gameW} height={gameH} onFinish={handleFinish} />}
        </View>
      </View>
    );
  }

  // ===== شاشة الاختيار =====
  const cardSize = (width - theme.spacing.md * 3) / 2;
  return (
    <View style={[s.flex, { paddingTop: insets.top + 16 }]}>
      <View style={s.selectHeader}>
        <Hakeem mood="happy" size={72} />
        <Text style={s.title}>اختَر لعبتك يا بطل!</Text>
        <Text style={s.subtitle}>أتقن الدرس... الحين وقت اللعب والجواهر</Text>
      </View>

      <View style={s.grid}>
        {GAMES.map((g) => (
          <TouchableOpacity
            key={g.id}
            style={[s.card, { width: cardSize }]}
            activeOpacity={0.85}
            onPress={() => {
              setGame(g.id);
              setPhase('play');
            }}
          >
            <View style={s.previewBox}>
              <GamePreview id={g.id} size={cardSize * 0.66} />
            </View>
            <Text style={s.cardTitle}>{g.title}</Text>
            <Text style={s.cardDesc}>{g.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: 12,
  },
  title: { fontFamily: theme.fonts.heading, fontSize: 24, color: theme.colors.textDark, textAlign: 'center' },
  subtitle: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' },

  // الاختيار
  selectHeader: { alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing.md, marginBottom: 18 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  previewBox: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardTitle: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.textDark },
  cardDesc: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },

  // اللعب
  playHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 19, color: theme.colors.primaryDark },
  playTitle: { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.textDark },
  gameArea: { flex: 1 },

  // الاحتفال
  rewardCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  rewardLabel: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted },
  rewardAmount: { fontFamily: theme.fonts.heading, fontSize: 30, color: theme.colors.gem },
  streakText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.streak },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 10,
  },
  btnText: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.white },
});
