import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors } from '../../theme/colors';

export default function Account() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn() {
    if (!email.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد وكلمة المرور');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('خطأ في الدخول', error.message);
  }

  async function signUp() {
    if (!email.trim() || !password) {
      Alert.alert('تنبيه', 'يرجى إدخال البريد وكلمة المرور');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('خطأ في إنشاء الحساب', error.message);
    else Alert.alert('تم', 'أُنشئ حسابك. تحقّق من بريدك إن طُلب التفعيل.');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>حسابي</Text>
        <Text style={styles.email}>{session.user.email}</Text>
        <TouchableOpacity style={styles.btnOut} onPress={signOut}>
          <Text style={styles.btnOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>حسابي</Text>
      <Text style={styles.note}>سجّل دخولك للوصول إلى المساعدين</Text>
      <TextInput
        style={styles.input}
        placeholder="البريد الإلكتروني"
        placeholderTextColor={colors.muted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        placeholderTextColor={colors.muted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {loading ? (
        <ActivityIndicator color={colors.emerald} style={{ marginTop: 16 }} />
      ) : (
        <>
          <TouchableOpacity style={styles.btn} onPress={signIn}>
            <Text style={styles.btnText}>دخول</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAlt} onPress={signUp}>
            <Text style={styles.btnAltText}>إنشاء حساب جديد</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: 'Cairo_700Bold', fontSize: 24, color: colors.emerald, marginBottom: 6 },
  note: { fontFamily: 'Tajawal_400Regular', fontSize: 14, color: colors.muted, marginBottom: 24 },
  email: { fontFamily: 'Tajawal_500Medium', fontSize: 15, color: colors.muted, marginBottom: 24 },
  input: { width: '100%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16, fontFamily: 'Tajawal_400Regular', color: colors.textDark },
  btn: { width: '100%', backgroundColor: colors.emerald, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { fontFamily: 'Tajawal_700Bold', color: '#FFFFFF', fontSize: 16 },
  btnAlt: { width: '100%', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnAltText: { fontFamily: 'Tajawal_700Bold', color: colors.emerald, fontSize: 15 },
  btnOut: { backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36, marginTop: 8 },
  btnOutText: { fontFamily: 'Tajawal_700Bold', color: '#FFFFFF', fontSize: 16 },
});
