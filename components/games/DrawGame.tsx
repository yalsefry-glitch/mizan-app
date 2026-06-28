// components/games/DrawGame.tsx
// اللعبة الأولى — الرسم الحيّ.
// حكيم يرسم مسارًا متموّجًا تدريجيًّا (Skia Path trim عبر خاصّية end).
// ثمّ يكمل الطفل المسار بإصبعه. التقييم بالمسافة الهندسية لا بصح/خطأ:
// مسار الطفل يتلوّن من أحمر لأخضر حسب الدقّة، والجواهر ١-٥ متدرّجة.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Path, Circle } from '@shopify/react-native-skia';
import {
  buildPath,
  pathAccuracy,
  accuracyToGems,
  accuracyColor,
  dist,
  type Pt,
} from './geometry';
import type { GameProps } from './types';
import { theme } from '../../config/theme';

type Phase = 'show' | 'draw' | 'result';

// مسار الهدف: موجة جيبية تعبر الشاشة.
function buildTarget(w: number, h: number): Pt[] {
  const pts: Pt[] = [];
  const n = 64;
  const midY = h * 0.5;
  const amp = h * 0.17;
  for (let i = 0; i <= n; i++) {
    const x = w * 0.12 + w * 0.76 * (i / n);
    const y = midY + amp * Math.sin((i / n) * Math.PI * 2);
    pts.push({ x, y });
  }
  return pts;
}

export default function DrawGame({ width, height, onFinish }: GameProps) {
  const target = useMemo(() => buildTarget(width, height), [width, height]);
  const targetPath = useMemo(() => buildPath(target), [target]);
  const norm = useMemo(() => Math.min(width, height) * 0.25, [width, height]);

  const [reveal, setReveal] = useState(0); // تقدّم رسم حكيم 0..1
  const [phase, setPhase] = useState<Phase>('show');
  const [pts, setPts] = useState<Pt[]>([]);
  const [acc, setAcc] = useState(0);

  const phaseRef = useRef<Phase>('show');
  const ptsRef = useRef<Pt[]>([]);
  const finishedRef = useRef(false);
  phaseRef.current = phase;

  // كشف تدريجي لمسار حكيم ثمّ تسليم الدور للطفل.
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const dur = 2400;
    const tick = () => {
      const now = Date.now();
      if (start === 0) start = now;
      const t = Math.min(1, (now - start) / dur);
      setReveal(t);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setPhase('draw');
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const begin = (x: number, y: number) => {
    try {
      if (phaseRef.current !== 'draw') return;
      ptsRef.current = [{ x, y }];
      setPts([{ x, y }]);
    } catch {
      // نتجاهل بصمت.
    }
  };

  const move = (x: number, y: number) => {
    try {
      if (phaseRef.current !== 'draw') return;
      const last = ptsRef.current[ptsRef.current.length - 1];
      if (last && dist(last, { x, y }) < 3) return; // تخفيف الكثافة
      ptsRef.current.push({ x, y });
      setPts([...ptsRef.current]);
    } catch {
      // نتجاهل بصمت.
    }
  };

  const end = () => {
    try {
      if (phaseRef.current !== 'draw' || finishedRef.current) return;
      if (ptsRef.current.length < 4) return; // خربشة قصيرة: نتركه يكمل
      finishedRef.current = true;
      const a = pathAccuracy(ptsRef.current, target, norm);
      setAcc(a);
      setPhase('result');
      const gems = accuracyToGems(a);
      setTimeout(() => onFinish(gems), 1400);
    } catch {
      // نتجاهل بصمت.
    }
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onBegin((e) => {
          'worklet';
          runOnJS(begin)(e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(move)(e.x, e.y);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(end)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const childPath = useMemo(() => buildPath(pts), [pts]);
  const childColor = phase === 'result' ? accuracyColor(acc) : theme.colors.primaryDark;

  return (
    <View style={styles.fill}>
      <Text style={styles.hint}>
        {phase === 'show'
          ? 'حكيم يرسم لك المسار... شوف زين'
          : phase === 'draw'
            ? 'يلّا كمّل المسار بإصبعك يا بطل'
            : `زين عليك! دقّتك ${Math.round(acc * 100)}٪`}
      </Text>

      <GestureDetector gesture={pan}>
        <View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            {/* مسار حكيم (يُرسم تدريجيًّا عبر trim) */}
            <Path
              path={targetPath}
              style="stroke"
              strokeWidth={6}
              strokeCap="round"
              strokeJoin="round"
              color={theme.colors.primaryLight}
              start={0}
              end={reveal}
            />

            {/* نقطة بداية مضيئة لإرشاد الطفل */}
            {phase !== 'show' && (
              <Circle cx={target[0].x} cy={target[0].y} r={9} color={theme.colors.primary} />
            )}

            {/* مسار الطفل (يتلوّن حسب الدقّة عند النتيجة) */}
            <Path
              path={childPath}
              style="stroke"
              strokeWidth={7}
              strokeCap="round"
              strokeJoin="round"
              color={childColor}
            />
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center' },
  hint: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: theme.colors.textDark,
    textAlign: 'center',
    paddingVertical: 10,
  },
});
