// app/_layout.tsx
// نقطة الدخول الجذرية لتطبيق «عالم حكيم».
// تهيّئ: gesture-handler (مطلوب أولًا)، الخطوط (Cairo/Tajawal)،
// اتّجاه RTL، وإخفاء شاشة البداية بعد الجاهزية.
// التنقّل عبر Stack (expo-router) دون رؤوس افتراضية.
// Error Boundary يلتقط أخطاء التصيير ويعرض رسالة عربية لطيفة.

import 'react-native-gesture-handler'; // يجب أن يكون أول استيراد
import { Component, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { I18nManager, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
import { theme } from '../config/theme';

// مفتاح اللغة المحفوظة (عربي افتراضًا).
const LANG_KEY = 'alamhakeem_language';

// السماح بالاتّجاهين؛ الافتراضي عربي (RTL).
I18nManager.allowRTL(true);

// منع إخفاء شاشة البداية حتى تجهز الخطوط والاتّجاه.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Error Boundary — مكوّن class يلتقط أخطاء التصيير ويعرض رسالة عربية لطيفة.
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.emoji}>😔</Text>
          <Text style={errorStyles.title}>حدث خطأ بسيط</Text>
          <Text style={errorStyles.message}>لا تقلق، يمكنك المحاولة مرة أخرى</Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleReset}>
            <Text style={errorStyles.buttonText}>أعد المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 15,
    color: theme.colors.textBody,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  buttonText: {
    fontFamily: theme.fonts.headingMed,
    fontSize: 16,
    color: theme.colors.white,
  },
});

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
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
