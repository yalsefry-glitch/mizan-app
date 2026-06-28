// components/games/RotateGame.tsx
// اللعبة الرابعة — البُعد الثالث.
// مجسّم مكعّب يُحاكى دورانه ثلاثيّ الأبعاد بإسقاط رياضي ذاتيّ على Skia
// (بديل مستقرّ عن WebGPU): دوران حول المحورين Y وX، إسقاط منظوري،
// وترتيب الأوجه بخوارزمية الرسّام. الطفل يدوّر بإصبعه ليجد «الوجه الذهبي»
// الذي يحمل الجواب (٣ × ٤ = ١٢) على الوجه الخلفي.

import { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Canvas, Path } from '@shopify/react-native-skia';
import { buildPolygon, type Pt } from './geometry';
import type { GameProps } from './types';
import { theme } from '../../config/theme';

interface V3 {
  x: number;
  y: number;
  z: number;
}

// رؤوس المكعّب الثمانية (نصف الضلع = 1).
const VERTS: V3[] = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: -1, y: 1, z: 1 },
];

// الأوجه الستّة: فهارس الرؤوس + اللون. الوجه «الذهبي» يحمل الجواب.
interface Face {
  idx: [number, number, number, number];
  color: string;
  gold: boolean;
}

const FACES: Face[] = [
  { idx: [0, 1, 2, 3], color: '#FF9F1C', gold: false }, // أمام (z-)
  { idx: [5, 4, 7, 6], color: '#F57C00', gold: true }, // خلف (z+) — الوجه الذهبي
  { idx: [4, 0, 3, 7], color: '#FFB84D', gold: false }, // يسار
  { idx: [1, 5, 6, 2], color: '#E86F00', gold: false }, // يمين
  { idx: [4, 5, 1, 0], color: '#FFCA68', gold: false }, // أعلى
  { idx: [3, 2, 6, 7], color: '#D96400', gold: false }, // أسفل
];

const GOLD = theme.colors.gem;

function rotate(p: V3, ay: number, ax: number): V3 {
  // دوران حول Y.
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  let x = p.x * cosY - p.z * sinY;
  let z = p.x * sinY + p.z * cosY;
  let y = p.y;
  // دوران حول X (إمالة).
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const y2 = y * cosX - z * sinX;
  const z2 = y * sinX + z * cosX;
  y = y2;
  z = z2;
  return { x, y, z };
}

export default function RotateGame({ width, height, onFinish }: GameProps) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.22;
  const FOV = 4.2;
  const CAM = 5; // مسافة الكاميرا على محور z

  const [angleY, setAngleY] = useState(0.6);
  const [angleX] = useState(-0.35);
  const [found, setFound] = useState(false);

  const angleYRef = useRef(0.6);
  const startedAtRef = useRef(Date.now());
  const finishedRef = useRef(false);

  const onRotate = (dx: number) => {
    try {
      if (finishedRef.current) return;
      angleYRef.current += dx * 0.01;
      setAngleY(angleYRef.current);
    } catch {
      // نتجاهل بصمت.
    }
  };

  const onRelease = () => {
    try {
      if (finishedRef.current) return;
      // هل الوجه الذهبي يواجه الكاميرا الآن؟ (مركزه الأقرب = أصغر z بعد الدوران)
      let goldZ = Infinity;
      let minOther = Infinity;
      for (const f of FACES) {
        let zc = 0;
        for (const i of f.idx) {
          const r = rotate(VERTS[i], angleYRef.current, angleX);
          zc += r.z;
        }
        zc /= 4;
        if (f.gold) goldZ = zc;
        else if (zc < minOther) minOther = zc;
      }
      if (goldZ <= minOther) {
        finishedRef.current = true;
        setFound(true);
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const gems = elapsed < 9 ? 5 : elapsed < 18 ? 4 : 3;
        setTimeout(() => onFinish(gems), 1600);
      }
    } catch {
      // نتجاهل بصمت.
    }
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onChange((e) => {
          'worklet';
          runOnJS(onRotate)(e.changeX);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(onRelease)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // حساب الأوجه المرسومة لهذا الإطار: إسقاط + ترتيب من الخلف للأمام.
  const drawn = useMemo(() => {
    const projected = VERTS.map((v) => {
      const r = rotate(v, angleY, angleX);
      const persp = FOV / (FOV + r.z + CAM);
      return {
        pt: { x: cx + r.x * scale * persp, y: cy - r.y * scale * persp } as Pt,
        z: r.z,
      };
    });
    const faces = FACES.map((f) => {
      const pts = f.idx.map((i) => projected[i].pt);
      const zc = (projected[f.idx[0]].z + projected[f.idx[1]].z + projected[f.idx[2]].z + projected[f.idx[3]].z) / 4;
      return { face: f, pts, zc };
    });
    // الأبعد (z أكبر) يُرسم أولًا.
    faces.sort((a, b) => b.zc - a.zc);
    return faces;
  }, [angleY, angleX, cx, cy, scale]);

  return (
    <View style={[styles.fill, { width, height }]}>
      <Text style={styles.hint}>
        {found ? 'لقيت الجواب! ٣ × ٤ = ١٢ ✨' : 'كم يساوي ٣ × ٤؟ دوّر الصندوق للوجه الذهبي'}
      </Text>

      <GestureDetector gesture={pan}>
        <View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            {drawn.map((d, i) => (
              <Path
                key={i}
                path={buildPolygon(d.pts)}
                color={d.face.gold ? GOLD : d.face.color}
                style="fill"
                opacity={0.96}
              />
            ))}
            {/* حدود الأوجه لإبراز الحوافّ */}
            {drawn.map((d, i) => (
              <Path
                key={`e${i}`}
                path={buildPolygon(d.pts)}
                color={theme.colors.textDark}
                style="stroke"
                strokeWidth={2}
                opacity={0.5}
              />
            ))}
          </Canvas>
        </View>
      </GestureDetector>

      {found && (
        <View style={styles.answer} pointerEvents="none">
          <Text style={styles.answerText}>١٢</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'flex-start' },
  hint: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 16,
    color: theme.colors.textDark,
    textAlign: 'center',
    paddingVertical: 10,
  },
  answer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerText: {
    fontFamily: theme.fonts.heading,
    fontSize: 72,
    color: theme.colors.white,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
