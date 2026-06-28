// app/(auth)/login.tsx
// شاشة دخول/تسجيل وليّ الأمر. تبديل بين وضعين (دخول / حساب جديد).
// عند النجاح: توجيه لاختيار الطفل (دخول) أو إعداد الأطفال (تسجيل جديد).

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { signInParent, signUpParent } from '../../core/auth';
import { supabase } from '../../core/supabase';
import { theme } from '../../config/theme';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // فحص توفّر البصمة على الجهاز (عتاد + بصمة مسجّلة).
  useEffect(() => {
    (async () => {
      try {
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(hasHw && enrolled);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  // الدخول بالبصمة: نجاح يدخل مباشرة (إن وُجدت جلسة)، فشل يبقى الدخول العادي.
  const loginWithBiometrics = async () => {
    setError(null);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'أكّد هويتك للدخول',
        cancelLabel: 'إلغاء',
      });
      if (!res.success) return; // إلغاء/فشل → نبقى على الدخول العادي بصمت.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace('/profiles');
      } else {
        setError('سجّل الدخول بالبريد مرّة أولى لتفعيل البصمة');
      }
    } catch {
      // أي خطأ → نبقى على الدخول العادي بصمت.
    }
  };

  const submit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('أدخل البريد وكلمة المرور');
      return;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setError('أدخل اسمك');
      return;
    }

    setLoading(true);
    if (mode === 'signin') {
      const res = await signInParent(email.trim(), password);
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? 'تعذّر الدخول');
        return;
      }
      router.replace('/profiles');
    } else {
      const res = await signUpParent(email.trim(), password, fullName.trim());
      setLoading(false);
      if (!res.ok) {
        setError(res.error ?? 'تعذّر التسجيل');
        return;
      }
      // حساب جديد -> إعداد الأطفال أوّل مرّة.
      router.replace('/(auth)/setup-children');
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>عالم حكيم</Text>
        <Text style={s.sub}>رحلة تعلّم ممتعة لأطفالك بإشراف ذكاء آمن</Text>

        <View style={s.card}>
          <Text style={s.title}>
            {mode === 'signin' ? 'دخول وليّ الأمر' : 'إنشاء حساب عائلي'}
          </Text>

          {mode === 'signup' && (
            <TextInput
              style={s.input}
              placeholder="اسمك"
              placeholderTextColor={theme.colors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          )}

          <TextInput
            style={s.input}
            placeholder="البريد الإلكتروني"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={s.passwordRow}>
            <TextInput
              style={[s.input, s.passwordInput]}
              placeholder="كلمة المرور"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={s.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={s.eyeIcon}>{showPassword ? '👁‍🗨' : '👁'}</Text>
            </TouchableOpacity>
          </View>

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={s.btnText}>
                {mode === 'signin' ? 'دخول' : 'إنشاء الحساب'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
            }}
          >
            <Text style={s.switch}>
              {mode === 'signin'
                ? 'ليس لديك حساب؟ سجّل أطفالك'
                : 'لديك حساب؟ سجّل الدخول'}
            </Text>
          </TouchableOpacity>

          {mode === 'signin' && biometricAvailable && (
            <TouchableOpacity style={s.bioBtn} onPress={loginWithBiometrics}>
              <Text style={s.bioIcon}>👆</Text>
              <Text style={s.bioText}>الدخول بالبصمة</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.primaryDark },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  logo: {
    fontFamily: theme.fonts.heading,
    fontSize: 34,
    color: theme.colors.white,
    textAlign: 'center',
  },
  sub: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.headingMed,
    fontSize: 20,
    color: theme.colors.textDark,
    marginBottom: 18,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: theme.fonts.body,
    color: theme.colors.textBody,
    marginBottom: 14,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 14,
  },
  passwordInput: {
    marginBottom: 0,
    paddingLeft: 48,
  },
  eyeBtn: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 0,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: { fontSize: 20 },
  error: {
    color: theme.colors.error,
    fontFamily: theme.fonts.bodyMed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.headingMed,
    fontSize: 16,
  },
  switch: {
    color: theme.colors.primaryDark,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  bioIcon: { fontSize: 20 },
  bioText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textDark,
  },
});
