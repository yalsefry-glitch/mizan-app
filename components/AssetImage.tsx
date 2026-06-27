// components/AssetImage.tsx
// عرض أصل مرن: إن وُجد مصدر فعلي عرضه عبر expo-image، وإلّا عرض
// بديلًا متدرّجًا أنيقًا (LinearGradient + تسمية) دون انهيار.
// يُستخدم في المتجر (حيوانات/مقتنيات) وأي مكان يعرض أصلًا فنيًّا.

import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { resolveAsset, placeholderColors, placeholderLabel } from '../config/assets';
import { theme } from '../config/theme';

interface AssetImageProps {
  assetUrl: string | null | undefined;
  size?: number;
}

export default function AssetImage({ assetUrl, size = 44 }: AssetImageProps) {
  const source = resolveAsset(assetUrl);

  // أصل فعلي متاح — عرض الصورة.
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  // لا أصل — بديل متدرّج أنيق بلون مشتقّ من الاسم.
  const [c1, c2] = placeholderColors(assetUrl);
  const label = placeholderLabel(assetUrl);
  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ph, { width: size, height: size, borderRadius: size * 0.22 }]}
    >
      <Text style={[styles.phLabel, { fontSize: Math.max(8, size * 0.18) }]} numberOfLines={1}>
        {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ph: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  phLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.white,
    textAlign: 'center',
  },
});
