// components/JourneyMap.tsx
// خريطة مسار التعلّم المتعرّجة، مرسومة بـSkia. تربط محطّات الدروس
// بمسار منحنٍ (نمط Duolingo). الخطّ من Skia (أداء عالٍ)، والمحطّات
// عناصر React عادية فوقه لتبقى قابلة للنقر.

import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { theme } from '../config/theme';

export interface Station {
  id: string;
  title: string;
  state: 'done' | 'current' | 'locked';
  stars?: number;
}

interface JourneyMapProps {
  stations: Station[];
  width?: number;
}

const STATION_SIZE = 84;
const V_GAP = 130; // المسافة الرأسية بين المحطّات
const AMPLITUDE = 0.28; // مقدار التعرّج يمينًا/يسارًا

export default function JourneyMap({ stations, width }: JourneyMapProps) {
  const screenW = width ?? Dimensions.get('window').width - 40;
  const centerX = screenW / 2;
  const totalH = stations.length * V_GAP + 40;

  // حساب إحداثيّات كل محطّة (تعرّج جيبي).
  const positions = stations.map((_, i) => {
    const y = 30 + i * V_GAP;
    const offset = Math.sin(i * 0.9) * screenW * AMPLITUDE;
    return { x: centerX + offset, y };
  });

  // بناء مسار Skia منحنٍ يصل المحطّات.
  const path = Skia.Path.Make();
  positions.forEach((pt, i) => {
    if (i === 0) {
      path.moveTo(pt.x, pt.y);
    } else {
      const prev = positions[i - 1];
      const midY = (prev.y + pt.y) / 2;
      path.cubicTo(prev.x, midY, pt.x, midY, pt.x, pt.y);
    }
  });

  return (
    <View style={{ width: screenW, height: totalH }}>
      {/* الخطّ المنحني (Skia) */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          path={path}
          style="stroke"
          strokeWidth={7}
          strokeCap="round"
          color={theme.colors.border}
        />
      </Canvas>

      {/* المحطّات (عناصر قابلة للنقر فوق الخطّ) */}
      {stations.map((station, i) => {
        const pos = positions[i];
        return (
          <View
            key={station.id}
            style={[
              styles.stationWrap,
              {
                left: pos.x - STATION_SIZE / 2,
                top: pos.y - STATION_SIZE / 2,
              },
            ]}
          >
            {/* المحتوى يُمرّر من الشاشة عبر renderStation لإبقاء النقر */}
          </View>
        );
      })}
    </View>
  );
}

// نُصدّر المواقع لتستخدمها الشاشة في وضع المحطّات القابلة للنقر.
export function computeStationPositions(count: number, screenW: number) {
  const centerX = screenW / 2;
  return Array.from({ length: count }).map((_, i) => {
    const y = 30 + i * V_GAP;
    const offset = Math.sin(i * 0.9) * screenW * AMPLITUDE;
    return { x: centerX + offset, y };
  });
}

export const JOURNEY_CONSTANTS = { STATION_SIZE, V_GAP };

const styles = StyleSheet.create({
  stationWrap: {
    position: 'absolute',
    width: STATION_SIZE,
    height: STATION_SIZE,
  },
});
