// components/Hakeem.tsx
// شخصية حكيم الحيّة. تعرض أنيميشن DotLottie (.lottie) إن توفّر الأصل،
// وإلّا تعرض حالة بديلة أنيقة (دائرة متدرّجة باسم حكيم) دون انهيار.
// البنية جاهزة لاستقبال الأصل الفني لاحقًا بمجرّد إضافته.

import { useState } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { theme } from '../config/theme';

// محاولة استيراد DotLottie بأمان: إن لم تكن المكتبة/الأصل جاهزَين،
// نسقط للحالة البديلة دون تعطيل التطبيق.
let DotLottie: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DotLottie = require('@lottiefiles/dotlottie-react-native').DotLottie;
} catch {
  DotLottie = null;
}

export type HakeemMood = 'idle' | 'happy' | 'think';

interface HakeemProps {
  mood?: HakeemMood;
  size?: number;
  style?: ViewStyle;
}

// خريطة المزاج -> ملفّ الأصل (يُضاف لاحقًا في assets/hakeem/).
const MOOD_SOURCE: Record<HakeemMood, string> = {
  idle: 'hakeem_idle',
  happy: 'hakeem_happy',
  think: 'hakeem_think',
};

// محاولة تحمي40 أصل الأنيميشن بأمان.
function loadLottieSource(mood: HakeemMood): any | null {
  try {
    switch (mood) {
      case 'happy':
        return require('../assets/hakeem/hakeem_happy.lottie');
      case 'think':
        return require('../assets/hakeem/hakeem_think.lottie');
      case 'idle':
      default:
        return require('../assets/hakeem/hakeem_idle.lottie');
    }
  } catch {
    return null;
  }
}

export default function Hakeem({ mood = 'idle', size = 130, style }: HakeemProps) {
  const [assetFailed, setAssetFailed] = useState(false);
  const source = loadLottieSource(mood);
  const canAnimate = DotLottie && source && !assetFailed;

  if (canAnimate) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <DotLottie
          source={source}
          style={{ width: size, height: size }}
          loop
          autoplay
          onError={() => setAssetFailed(true)}
        />
      </View>
    );
  }

  // ===== الحالة البديلة الأنيقة (حتّى توفّر الأصل الفني) =====
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.fallbackName, { fontSize: size * 0.22 }]}>حكيم</Text>
      <View style={styles.dotRow}>
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // تدرّج بسيط عبر ظلّ داخلي محاكٍ
    borderWidth: 4,
    borderColor: theme.colors.primaryLight,
  },
  fallbackName: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.white,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
});
