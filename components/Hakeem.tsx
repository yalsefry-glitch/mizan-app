// components/Hakeem.tsx
// شخصية حكيم بنمط مرن (Resilient). لا تستورد أي ملفّ .lottie ثابت
// عبر require — لتفادي كسر البناء عند غياب الأصل. تعرض حاليًّا بديلًا
// متدرّجًا أنيقًا (دائرة بألوان الهوية + اسم حكيم). عند توفّر أصل
// Lottie لاحقًا، يُسجّل في config/assets ويُعرض دون تغيير هذا الملف.

import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../config/theme';

export type HakeemMood = 'idle' | 'happy' | 'think';

interface HakeemProps {
  mood?: HakeemMood;
  size?: number;
  style?: ViewStyle;
}

// تعبير مختصر حسب المزاج (يظهر في البديل المتدرّج).
const MOOD_FACE: Record<HakeemMood, string> = {
  idle: '🦉',
  happy: '🦉',
  think: '🦉',
};

const MOOD_RING: Record<HakeemMood, string> = {
  idle: theme.colors.primaryLight,
  happy: theme.colors.success,
  think: theme.colors.gem,
};

export default function Hakeem({ mood = 'idle', size = 130, style }: HakeemProps) {
  // حاليًّا لا أصل Lottie مسجّل — نعرض البديل المتدرّج الأنيق دائمًا.
  // (عند تسجيل أصل لاحقًا، يُضاف فحص hasAsset هنا ويُعرض المشغّل.)
  return (
    <View style={[{ width: size, height: size }, style]}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: MOOD_RING[mood],
          },
        ]}
      >
        <Text style={[styles.face, { fontSize: size * 0.34 }]}>{MOOD_FACE[mood]}</Text>
        <Text style={[styles.name, { fontSize: size * 0.13 }]}>حكيم</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  face: {
    textAlign: 'center',
  },
  name: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.white,
    marginTop: 2,
  },
});
