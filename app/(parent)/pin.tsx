// app/(parent)/pin.tsx
// بوّابة الرقم السرّي (PIN) لحماية لوحة وليّ الأمر.
// أوّل مرّة: تعيين PIN جديد. بعدها: التحقّق منه قبل الدخول.

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getCurrentParent, setParentPin, verifyParentPin } from '../../core/auth';
import { theme } from '../../config/theme';

const PIN_LENGTH = 4;

export default function PinScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'loading' | 'set' | 'verify'>('loading');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  // تحديد الوضع: تعيين (لا PIN بعd) أم تحقّق (PIN موجod).
  useEffect(() => {
    (async () => {
      const parent = await getCurrentParent();
      setMode(parent?.parent_pin ? 'verify' : 'set');
    })();
  }, []);

  const press = async (digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + digit;
    setPin(next);
    setError(null);

    if (next.length === PIN_LENGTH) {
      if (mode === 'set') {
        const res = await setParentPin(next);
        if (res.ok) {
          router.replace('/(parent)/dashboard');
        } else {
          setError(res.error ?? 'تعذّر الحفظ');
          setPin('');
        }
      } else {
        const ok = await verifyParentPin(next);
        if (ok) {
          router.replace('/(parent)/dashboard');
        } else {
          setError('الرقم السرّي غير صحيح');
          setPin('');
        }
      }
    }
  };

  const clear = () => setPin((p) => p.slice(0, -1));

  const keys = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const digitMap: Record<string, string> = {
    '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5',
    '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٠': '0',
  };

  return (
    <View style={s.container}>
      <Text style={s.lock}>🔒</Text>
      <Text style={s.title}>
        {mode === 'set' ? 'اختر رقمًا سرّيًّا' : 'لوحة وليّ الأمر'}
      </Text>
      <Text style={s.sub}>
        {mode === 'set' ? 'أربعة أرقام لحماية اللوحة' : 'أدخل الرقم السرّي'}
      </Text>

      {/* نقاط الـPIN */}
      <View style={s.dots}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[s.dot, i < pin.length && s.dotFilled]} />
        ))}
      </View>

      {error && <Text style={s.error}>{error}</Text>}

      {/* لوحة الأرقام */}
      <View style={s.pad}>
        {keys.map((k) => (
          <TouchableOpacity key={k} style={s.key} onPress={() => press(digitMap[k])}>
            <Text style={s.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.key} onPress={() => router.back()}>
          <Text style={s.keyText}>↩</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.key} onPress={() => press('0')}>
          <Text style={s.keyText}>٠</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.key} onPress={clear}>
          <Text style={s.keyText}>⌫</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: 10,
  },
  lock: { fontSize: 50 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.white },
  sub: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: '#94A3B8', marginBottom: 10 },
  dots: { flexDirection: 'row', gap: 14, marginVertical: 16 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotFilled: { backgroundColor: theme.colors.white },
  error: { fontFamily: theme.fonts.bodyMed, fontSize: 13, color: '#FCA5A5' },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 260,
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: theme.fonts.heading, fontSize: 24, color: theme.colors.white },
});
