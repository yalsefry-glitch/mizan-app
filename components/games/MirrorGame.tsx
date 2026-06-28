// components/games/MirrorGame.tsx
// اللعبة الثانية — المرآة.
// الشاشة نصفان. حكيم يرسم شكلًا على اليسار تدريجيًّا، والطفل يعكسه
// بإصبعه على اليمين. التقييم بمقارنة مسار الطفل بانعكاس شكل حكيم
// رياضيًّا (نقطة (x,y) تقابل (العرض - x, y)). الجواهر ١-٥ حسب الدقّة.

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Path, Line, vec } from '@shopify/react-native-skia';
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

// شكل حكيم على النصف الأيسر: خطّ متعرّج (جبل) يحفّز الطفل على عكسه.
function buildLeftShape(w: number, h: number): Pt[] {
  const x0 = w * 0.08;
  const x1 = w * 0.46;
  const midY = h * 0.5;
  const amp = h * 0.26;
  return [
    { x: x0, y: midY + amp },
    { x: x0 + (x1 - x0) * 0.33, y: midY - amp * 0.5 },
    { x: x0 + (x1 - x0) * 0.5, y: midY + amp * 0.2 },
    { x: x0 + (x1 - x0) * 0.66, y: midY - amp },
    { x: x1, y: midY + amp * 0.6 },
  ];
}

export default function MirrorGame({ width, height, onFinish }: GameProps) {
  const left = useMemo(() => buildLeftShape(width, height), [width, height]);
  const leftPath = useMemo(() => buildPath(left), [left]);
  // انعكاس الشكل حول المحور الرأسي في المنتصف (الهدف المتوقّع لرسم الطفل).
  const mirrored = useMemo<Pt[]>(() => left.map((p) => ({ x: width - p.x, y: p.y })), [left, width]);
  const norm = useMemo(() => Math.min(width, height) * 0.28, [width, height]);

  const [reveal, setReveal] = useState(0);
  const [phase, setPhase] = useState<Phase>('show');
  const [pts, setPts] = useState<Pt[]>([]);
  const [acc, setAcc] = useState(0);

  const phaseRef = useRef<Phase>('show');
  const ptsRef = useRef<Pt[]>([]);
  const finishedRef = useRef(false);
  phaseRef.current = phase;

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const dur = 2200;
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
      if (last && dist(last, { x, y }) < 3) return;
      ptsRef.current.push({ x, y });
      setPts([...ptsRef.current]);
    } catch {
      // نتجاهل بصمت.
    }
  };

  const end = () => {
    try {
      if (phaseRef.current !== 'draw' || finishedRef.current) return;
      if (ptsRef.current.length < 4) return;
      finishedRef.current = true;
      const a = pathAccuracy(ptsRef.current, mirrored, norm);
      setAcc(a);
      setPhase('result');
      setTimeout(() => onFinish(accuracyToGems(a)), 1400);
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
          ? 'حكيم يرسم على اليسار... راقبه'
          : phase === 'draw'
            ? 'اعكس الشكل على اليمين بإصبعك'
            : `إبداع! دقّة الانعكاس ${Math.round(acc * 100)}٪`}
      </Text>

      <GestureDetector gesture={pan}>
        <View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            {/* محور المرآة في المنتصف */}
            <Line
              p1={vec(width / 2, 0)}
              p2={vec(width / 2, height)}
              color={theme.colors.border}
              style="stroke"
              strokeWidth={2}
            />

            {/* شكل حكيم (يسار) يُرسم تدريجيًّا */}
            <Path
              path={leftPath}
              style="stroke"
              strokeWidth={6}
              strokeCap="round"
              strokeJoin="round"
              color={theme.colors.primary}
              start={0}
              end={reveal}
            />

            {/* انعكاس مرشد خافت (يمين) يظهر بعد اكتمال رسم حكيم */}
            {phase !== 'show' && (
              <Path
                path={buildPath(mirrored)}
                style="stroke"
                strokeWidth={3}
                color={theme.colors.border}
              />
            )}

            {/* مسار الطفل */}
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
