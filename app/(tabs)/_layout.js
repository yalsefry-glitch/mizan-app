import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import {
  I18nManager,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
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
import { ThemeProvider, useTheme } from '../theme/ThemeContext';
import { LanguageProvider, useLang } from '../theme/LanguageContext';

// الاتجاه الافتراضي عند أول إقلاع: عربي (RTL). يُضبط لاحقاً حسب اللغة المحفوظة.
I18nManager.allowRTL(true);
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {});

const BIO_KEY = 'mizan_biometric_lock';

// بوّابة القفل بالبصمة. تعيش داخل ThemeProvider وLanguageProvider،
// فتتبع الثيم واللغة. تقفل عند أوّل فتح فقط (لا عند الخلفية).
function LockGate() {
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = makeStyles(colors);
  const [locked, setLocked] = useState(false);

  async function authenticate() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('lock_prompt'),
      cancelLabel: t('cancel'),
    });
    if (result.success) setLocked(false);
  }

  useEffect(() => {
    AsyncStorage.getItem(BIO_KEY).then((v) => {
      if (v === 'true') {
        setLocked(true);
        authenticate();
      }
    });
  }, []);

  if (!locked) return null;

  return (
    <LinearGradient
      colors={[colors.emerald, colors.emeraldDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.lock}
    >
      <View style={styles.lockEmblem}>
        <Ionicons name="lock-closed" size={42} color={colors.goldLight} />
      </View>
      <Text style={styles.lockTitle}>{t('lock_welcome')}</Text>
      <Pressable style={styles.lockBtn} onPress={authenticate}>
        <Ionicons name="finger-print" size={22} color={colors.emerald} />
        <Text style={styles.lockBtnText}>{t('lock_open_btn')}</Text>
      </Pressable>
    </LinearGradient>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <ThemeProvider>
        <KeyboardProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <LockGate />
        </KeyboardProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  lock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  lockEmblem: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: 'rgba(227,199,102,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: { fontFamily: 'Cairo_900Black', fontSize: 26, color: '#FFFFFF', marginTop: 6 },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 12,
  },
  lockBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.emerald },
});
