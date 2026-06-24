import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  I18nManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

const BIO_KEY = 'mizan_biometric_lock';

// شعار Google الرسمي (حرف G بالألوان الأربعة)
function GoogleLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export default function Account() {
  const insets = useSafeAreaInsets();
  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';

  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    AsyncStorage.getItem(BIO_KEY).then((v) => setBioEnabled(v === 'true'));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function toggleBiometric(value) {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        Alert.alert('غير متاح', 'جهازك لا يدعم البصمة أو لا توجد بصمة مسجّلة في إعدادات الجهاز.');
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'أكّد بصمتك لتفعيل القفل',
        cancelLabel: 'إلغاء',
      });
      if (!result.success) return;
      await AsyncStorage.setItem(BIO_KEY, 'true');
      setBioEnabled(true);
    } else {
      await AsyncStorage.setItem(BIO_KEY, 'false');
      setBioEnabled(false);
    }
  }

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد وكلمة المرور.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('تعذّر الدخول', error.message);
  }

  async function signUp() {
    if (!email.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد وكلمة المرور.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('تعذّر إنشاء الحساب', error.message);
    else Alert.alert('تحقّق من بريدك', 'أُرسل رابط التفعيل إلى بريدك الإلكتروني.');
  }

  async function forgotPassword() {
    if (!email.trim()) {
      Alert.alert('نسيت كلمة المرور', 'اكتب بريدك الإلكتروني أولاً، ثم اضغط نسيت كلمة المرور.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (error) Alert.alert('تعذّر الإرسال', error.message);
    else Alert.alert('تحقّق من بريدك', 'أُرسل رابط استعادة كلمة المرور إلى بريدك.');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // أثناء فحص الجلسة: شاشة تحميل (تمنع وميض شاشة الدخول)
  if (checking) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.emerald} />
      </View>
    );
  }

  // مسجّل دخول: لوحة الحساب
  if (session) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[colors.emerald, colors.emeraldDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.head, { paddingTop: insets.top + 18 }]}
        >
          <Text style={styles.headTitle}>حسابي</Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={28} color={colors.goldLight} />
            </View>
            <Text style={[styles.emailText, { writingDirection: writingDir }]}>{session.user?.email}</Text>
            <Text style={[styles.planText, { writingDirection: writingDir }]}>حساب نشط</Text>
          </View>

          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="notifications-outline" size={19} color={colors.textBody} />
                <Text style={[styles.settingText, { writingDirection: writingDir }]}>الإشعارات</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="finger-print-outline" size={19} color={colors.textBody} />
                <Text style={[styles.settingText, { writingDirection: writingDir }]}>قفل بالبصمة</Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={toggleBiometric}
                trackColor={{ false: colors.border, true: colors.emerald }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <Ionicons name="document-text-outline" size={19} color={colors.textBody} />
                <Text style={[styles.settingText, { writingDirection: writingDir }]}>الشروط والخصوصية</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
            </View>
            <View style={styles.divider} />
            <Pressable style={styles.settingRow} onPress={signOut}>
              <View style={styles.settingLabel}>
                <Ionicons name="log-out-outline" size={19} color={colors.muted} />
                <Text style={[styles.settingText, { writingDirection: writingDir, color: colors.muted }]}>تسجيل الخروج</Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
            </Pressable>
          </View>

          <Text style={[styles.disclaimer, { writingDirection: writingDir }]}>
            ميزان مساعد استرشادي للتوعية، والمعلومات قد تتغيّر، ويُنصح بالتحقّق من مختصّ قبل الإجراء.
          </Text>
        </ScrollView>
      </View>
    );
  }

  // غير مسجّل: شاشة الدخول/التسجيل
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.emerald, colors.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.head, { paddingTop: insets.top + 18 }]}
      >
        <Text style={styles.headTitle}>{mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <TextInput
            style={[styles.input, { writingDirection: writingDir }]}
            placeholder="البريد الإلكتروني"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.pwWrap}>
            <TextInput
              style={[styles.input, styles.pwInput, { writingDirection: writingDir }]}
              placeholder="كلمة المرور"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.eye} onPress={() => setShowPw((v) => !v)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
            </Pressable>
          </View>

          {mode === 'signin' ? (
            <Pressable onPress={forgotPassword}>
              <Text style={[styles.forgot, { writingDirection: writingDir }]}>نسيت كلمة المرور؟</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.primaryBtn} onPress={mode === 'signin' ? signIn : signUp} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>أو</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable
            style={styles.googleBtn}
            onPress={() => Alert.alert('قريباً', 'الدخول عبر Google سيُفعّل قريباً.')}
          >
            <GoogleLogo size={20} />
            <Text style={styles.googleBtnText}>المتابعة عبر Google</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          <Text style={[styles.switchText, { writingDirection: writingDir }]}>
            {mode === 'signin' ? 'ليس لديك حساب؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}
          </Text>
        </Pressable>

        <Text style={[styles.disclaimer, { writingDirection: writingDir }]}>
          ميزان مساعد استرشادي للتوعية، والمعلومات قد تتغيّر، ويُنصح بالتحقّق من مختصّ قبل الإجراء.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingRoot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  head: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headTitle: { fontFamily: 'Cairo_700Bold', fontSize: 20, color: '#FFFFFF' },
  body: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emailText: { fontFamily: 'Cairo_700Bold', fontSize: 16, color: colors.textDark },
  planText: { fontFamily: 'Tajawal_400Regular', fontSize: 13, color: colors.gold, marginTop: 4 },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    fontFamily: 'Tajawal_400Regular',
    fontSize: 15,
    color: colors.textDark,
    backgroundColor: colors.bg,
    marginBottom: 11,
  },
  pwWrap: { width: '100%', position: 'relative', justifyContent: 'center' },
  pwInput: { paddingLeft: 46 },
  eye: { position: 'absolute', left: 13, height: 50, justifyContent: 'center' },
  forgot: { fontFamily: 'Tajawal_500Medium', fontSize: 13, color: colors.emerald, alignSelf: 'flex-start', marginBottom: 12 },
  primaryBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  primaryBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 16, color: '#FFFFFF' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontFamily: 'Tajawal_400Regular', fontSize: 12, color: colors.muted },
  googleBtn: {
    width: '100%',
    height: 50,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 11,
  },
  googleBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 14.5, color: colors.textDark },
  bioBtn: {
    width: '100%',
    height: 50,
    borderRadius: 13,
    backgroundColor: 'rgba(15,81,50,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  bioBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 14.5, color: colors.emerald },
  switchText: { fontFamily: 'Tajawal_500Medium', fontSize: 14, color: colors.emerald, textAlign: 'center', marginTop: 18 },
  settingsCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  settingLabel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { fontFamily: 'Tajawal_500Medium', fontSize: 15, color: colors.textDark },
  divider: { height: 1, backgroundColor: colors.border },
  disclaimer: { fontFamily: 'Tajawal_400Regular', fontSize: 11.5, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 18 },
});
