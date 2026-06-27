// components/PlanetCanvas.tsx
// كوكب الطفل الحيّ، مرسوم بـSkia (GPU). يعكس حالة الطقس:
// - thriving (مزدهر): ألوان خضراء مشبعة + توهّج + شمس.
// - cloudy (غائم): ألوان رمادية باهتة + توهّج خافت.
// رسم تصريحي صرف (Canvas + Circle + RadialGradient) — أداء عالٍ.

import { View, StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  RadialGradient,
  BlurMask,
  vec,
} from '@shopify/react-native-skia';
import type { Weather } from '../core/streaks';

interface PlanetCanvasProps {
  weather: Weather;
  size?: number;
}

// ألوان الكوكب حسب الطقس.
const PALETTES = {
  thriving: {
    glow: 'rgba(52,211,153,0.55)',
    inner: '#A7F3D0',
    mid: '#34D399',
    outer: '#059669',
  },
  cloudy: {
    glow: 'rgba(148,163,184,0.25)',
    inner: '#CBD5E1',
    mid: '#94A3B8',
    outer: '#64748B',
  },
} as const;

export default function PlanetCanvas({ weather, size = 220 }: PlanetCanvasProps) {
  const p = PALETTES[weather];
  const cx = size / 2;
  const cy = size / 2;
  const planetR = size * 0.3;
  const glowR = size * 0.42;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* هالة التوهّج خلف الكوكب */}
        <Circle cx={cx} cy={cy} r={glowR} color={p.glow}>
          <BlurMask blur={28} style="normal" />
        </Circle>

        {/* جسم الكوكب بتدرّج شعاعي */}
        <Circle cx={cx} cy={cy} r={planetR}>
          <RadialGradient
            c={vec(cx - planetR * 0.3, cy - planetR * 0.3)}
            r={planetR * 1.5}
            colors={[p.inner, p.mid, p.outer]}
          />
        </Circle>

        {/* ظلّ سفلي داخلي لإحساس الكرة */}
        <Group>
          <Circle cx={cx} cy={cy + planetR * 0.35} r={planetR * 0.9} color="rgba(0,0,0,0.18)">
            <BlurMask blur={18} style="normal" />
          </Circle>
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
