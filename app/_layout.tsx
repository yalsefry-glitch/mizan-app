// app/_layout.tsx
// نقطة الدخول الجذرية لتطبيق «عالم حكيم».
// تهيّئ: gesture-handler (مطلوب أولًا)، الخطوط (Cairo/Tajawal)،
// اتّجاه RTL، وإخفاء شاشة البداية بعد الجاهزية.
// التنقّل عبر Stack (expo-router) دون رؤوس افتراضية.

import 'react-native-gesture-handler'; // يجب أن يكون أول استيراد
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { I18nManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Cairo_700Bold,
  Cairo_800ExtraBold,
  Cairo_900Black,
} from '@expo-google-fonts/cairo';
import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
} from '@expo-google-fonts/tajawal';
import { ThemeProvider } from '../contexts/ThemeContext';

// مفتاح اللغة المحفوظة (عربي افتراضًا).
const LANG_KEY = 'alamhakeem_language';

// السماح بالاتّجاهين؛ الافتراضي عربي (RTL).
I18nManager.allowRTL(true);

// منع إخفاء شاشة البداية حتى تجهز الخطوط والاتّجاه.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // تحميل خطوط الهوية.
  const [fontsLoaded] = useFonts({
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  // ضبط اتّجاه الكتابة حسب اللغة المحفوظة.
  const [dirReady, setDirReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        const shouldBeRTL = saved !== 'en'; // الافتراضي عربي
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(true);
          I18nManager.forceRTL(shouldBeRTL);
        }
      } catch {
        // عند أي خطأ: نكمل بالاتّجاه الحالي دون تعطيل الإقلاع.
      }
      if (active) setDirReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // إخفاء شاشة البداية عند اكتمال الجاهزية.
  useEffect(() => {
    if (fontsLoaded && dirReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, dirReady]);

  // انتظار الجاهزية قبل الرسم (تفادي وميض الاتّجاه/الخطّ الخاطئ).
  if (!fontsLoaded || !dirReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
