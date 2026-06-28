// components/games/Confetti.tsx
// احتفال نثار (confetti) مرسوم بالكامل بـ Skia — لا أصول فنية.
// قصاصات ملوّنة تتساقط مع تمايل ودوران، مدفوعة بحلقة requestAnimationFrame.

import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Group, RoundedRect, vec } from '@shopify/react-native-skia';
import { theme } from '../../config/theme';

interface ConfettiProps {
  width: number;
  height: number;
  count?: number;
}

interface Piece {
  x: number; // الموضع الأفقي الابتدائي (نسبة 0..1)
  delay: number; // تأخير السقوط (0..1)
  size: number;
  color: string;
  sway: number; // سعة التمايل الأفقي
  spin: number; // سرعة الدوران
}

const COLORS = [
  theme.colors.primary,
  theme.colors.primaryLight,
  theme.colors.gem,
  theme.colors.success,
  '#FF6B6B',
  '#4ECDC4',
];

// توليد قصاصات ثابتة (بذور شبه عشوائية مشتقّة من الفهرس — بلا Math.random وقت الرسم).
function makePieces(count: number): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = (Math.sin(i * 78.233) * 12543.123) % 1;
    const r3 = (Math.sin(i * 4.1357) * 9821.77) % 1;
    pieces.push({
      x: Math.abs(r1),
      delay: Math.abs(r2) * 0.5,
      size: 7 + Math.abs(r3) * 9,
      color: COLORS[i % COLORS.length],
      sway: 18 + Math.abs(r1) * 26,
      spin: 2 + Math.abs(r2) * 5,
    });
  }
  return pieces;
}

export default function Confetti({ width, height, count = 70 }: ConfettiProps) {
  const pieces = useRef<Piece[]>(makePieces(count)).current;
  const [t, setT] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const DURATION = 2800;
    const loop = () => {
      const now = Date.now();
      if (startRef.current === 0) startRef.current = now;
      const elapsed = (now - startRef.current) / DURATION;
      setT(elapsed);
      if (elapsed < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {pieces.map((p, i) => {
        // تقدّم هذه القصاصة (مع تأخيرها) ضمن المجال 0..1.
        const prog = Math.max(0, Math.min(1, (t - p.delay) / (1 - p.delay)));
        const px = p.x * width + Math.sin(prog * Math.PI * 2 * p.spin) * p.sway;
        const py = -p.size + prog * (height + p.size * 2);
        const rot = prog * Math.PI * 2 * p.spin;
        const opacity = prog < 0.92 ? 1 : Math.max(0, (1 - prog) / 0.08);
        return (
          <Group key={i} transform={[{ rotate: rot }]} origin={vec(px + p.size / 2, py + p.size / 2)}>
            <RoundedRect
              x={px}
              y={py}
              width={p.size}
              height={p.size * 1.5}
              r={2}
              color={p.color}
              opacity={opacity}
            />
          </Group>
        );
      })}
    </Canvas>
  );
}
