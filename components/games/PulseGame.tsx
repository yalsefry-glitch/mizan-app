// components/games/PulseGame.tsx
// اللعبة الثالثة — النبضة.
// شاشة داكنة، ضوء ينبض في المنتصف بإيقاع مرتبط بمفهوم الدرس:
// الضرب ٣ × ٤ = ثلاث نبضات تتكرّر أربع مرّات. حكيم يعرض الإيقاع أولًا،
// ثمّ يلمس الطفل الشاشة بنفس الإيقاع. التقييم بدقّة التوقيت (تعلّم حسّي).

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Circle, Group, BlurMask, RadialGradient, vec } from '@shopify/react-native-skia';
import { accuracyToGems, clamp01 } from './geometry';
import type { GameProps } from './types';
import { theme } from '../../config/theme';

type Phase = 'demo' | 'tap' | 'result';

const GROUPS = 4; // عدد التكرارات (× ٤)
const BEATS = 3; // نبضات كل مجموعة (٣)
const IN_GAP = 360; // الفاصل بين نبضات المجموعة (مللي ثانية)
const OUT_GAP = 720; // الفاصل بين المجموعات
const TOLERANCE = 280; // سماحية الخطأ الزمني لكل فاصل

// أزمنة النبضات (مللي ثانية من بداية العرض).
function buildBeatTimes(): number[] {
  const times: number[] = [];
  let t = 0;
  for (let g = 0; g < GROUPS; g++) {
    for (let b = 0; b < BEATS; b++) {
      times.push(t);
      t += b < BEATS - 1 ? IN_GAP : OUT_GAP;
    }
  }
  return times;
}

export default function PulseGame({ width, height, onFinish }: GameProps) {
  const beatTimes = useMemo(buildBeatTimes, []);
  const targetIntervals = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i < beatTimes.length; i++) arr.push(beatTimes[i] - beatTimes[i - 1]);
    return arr;
  }, [beatTimes]);

  const cx = width / 2;
  const cy = height / 2;
  const baseR = Math.min(width, height) * 0.12;

  const [phase, setPhase] = useState<Phase>('demo');
  const [flash, setFlash] = useState(0); // شدّة الومضة 0..1
  const [tapCount, setTapCount] = useState(0);
  const [acc, setAcc] = useState(0);

  const phaseRef = useRef<Phase>('demo');
  const lastBeatRef = useRef(0); // وقت آخر نبضة/لمسة (للومضة)
  const tapTimesRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  phaseRef.current = phase;

  // حلقة رسم الومضة: تتلاشى الشدّة مع الزمن منذ آخر نبضة.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const since = Date.now() - lastBeatRef.current;
      setFlash(clamp01(1 - since / 320));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // عرض الإيقاع: جدولة ومضة عند كل نبضة، ثمّ تسليم الدور للطفل.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const lead = 700;
    for (const bt of beatTimes) {
      timers.push(
        setTimeout(() => {
          lastBeatRef.current = Date.now();
        }, lead + bt)
      );
    }
    const total = lead + beatTimes[beatTimes.length - 1] + 900;
    timers.push(setTimeout(() => setPhase('tap'), total));
    return () => timers.forEach(clearTimeout);
  }, [beatTimes]);

  const evaluate = () => {
    const taps = tapTimesRef.current;
    if (taps.length < 2) {
      setAcc(0);
      setPhase('result');
      setTimeout(() => onFinish(1), 1200);
      return;
    }
    const childIntervals: number[] = [];
    for (let i = 1; i < taps.length; i++) childIntervals.push(taps[i] - taps[i - 1]);
    // متوسّط الخطأ النسبي مقابل الفواصل المستهدفة.
    let sum = 0;
    const n = Math.min(childIntervals.length, targetIntervals.length);
    for (let i = 0; i < n; i++) {
      sum += Math.abs(childIntervals[i] - targetIntervals[i]);
    }
    const avgErr = n > 0 ? sum / n : TOLERANCE;
    const a = clamp01(1 - avgErr / TOLERANCE);
    setAcc(a);
    setPhase('result');
    setTimeout(() => onFinish(accuracyToGems(a)), 1400);
  };

  const onTap = () => {
    try {
      if (phaseRef.current !== 'tap' || finishedRef.current) return;
      const now = Date.now();
      lastBeatRef.current = now;
      tapTimesRef.current.push(now);
      const c = tapTimesRef.current.length;
      setTapCount(c);
      if (c >= beatTimes.length) {
        finishedRef.current = true;
        evaluate();
      }
    } catch {
      // نتجاهل بصمت.
    }
  };

  const tap = useMemo(
    () =>
      Gesture.Tap().onStart(() => {
        'worklet';
        runOnJS(onTap)();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const glowR = baseR * (1 + flash * 0.9);
  const totalBeats = beatTimes.length;

  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.fill, { width, height }]}>
        <Canvas style={{ width, height }}>
          {/* هالة نابضة */}
          <Circle cx={cx} cy={cy} r={glowR * 1.6} color={theme.colors.gem} opacity={0.18 + flash * 0.5}>
            <BlurMask blur={40} style="normal" />
          </Circle>
          {/* قلب الضوء */}
          <Group>
            <Circle cx={cx} cy={cy} r={glowR}>
              <RadialGradient
                c={vec(cx, cy)}
                r={glowR}
                colors={['#FFF7D6', theme.colors.gem, theme.colors.primaryDark]}
              />
            </Circle>
          </Group>
        </Canvas>

        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.hint}>
            {phase === 'demo'
              ? 'احفظ الإيقاع: ٣ نبضات × ٤ مرّات'
              : phase === 'tap'
                ? `المس بنفس الإيقاع (${tapCount}/${totalBeats})`
                : `إيقاعك حلو! دقّتك ${Math.round(acc * 100)}٪`}
          </Text>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: '#1A120B', alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' },
  hint: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: theme.colors.white,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
