import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import {
  I18nManager,
  AppState,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import { colors } from '../theme/colors';

// إجبار الاتجاه من اليمين لليسار
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

SplashScreen.preventAutoHideAsync().catch(() => {});

const BIO_KEY = 'mizan_biometric_lock';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Cairo_700Bold,
    Cairo_800ExtraBold,
    Cairo_900Black,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  lockedRef.current = locked;

  async function authenticate() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'افتح ميزان ببصمتك',
      cancelLabel: 'إلغاء',
    });
    if (result.success) setLocked(false);
  }

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // عند فتح التطبيق: إن كان القفل مفعّلاً، اقفل واطلب البصمة
    AsyncStorage.getItem(BIO_KEY).then((v) => {
      if (v === 'true') {
        setLocked(true);
        authenticate();
      }
    });

    // عند العودة من الخلفية: أعد القفل إن كان مفعّلاً
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        AsyncStorage.getItem(BIO_KEY).then((v) => {
          if (v === 'true') setLocked(true);
        });
      } else if (next === 'active' && lockedRef.current) {
        authenticate();
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {locked ? (
        <LinearGradient
          colors={[colors.emerald, colors.emeraldDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lock}
        >
          <View style={styles.lockEmblem}>
            <Ionicons name="lock-closed" size={42} color={colors.goldLight} />
          </View>
          <Text style={styles.lockTitle}>ميزان مقفل</Text>
          <Text style={styles.lockNote}>افتح التطبيق ببصمتك</Text>
          <Pressable style={styles.lockBtn} onPress={authenticate}>
            <Ionicons name="finger-print" size={22} color={colors.emerald} />
            <Text style={styles.lockBtnText}>فتح بالبصمة</Text>
          </Pressable>
        </LinearGradient>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
  lockNote: { fontFamily: 'Tajawal_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
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
