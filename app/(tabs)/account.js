import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';

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
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert('خطأ في الدخول', error.message);
  }

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
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
        <Text style={styles.note}>{session.user.email}</Text>
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
        placeholderTextColor="#9CA9A2"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="كلمة المرور"
        placeholderTextColor="#9CA9A2"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {loading ? (
        <ActivityIndicator color="#0F5132" style={{ marginTop: 16 }} />
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
  container: { flex: 1, backgroundColor: '#FBFCFA', alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { color: '#0F5132', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  note: { color: '#9CA9A2', fontSize: 14, marginBottom: 24 },
  input: { width: '100%', backgroundColor: '#FFFFFF', borderColor: '#E3EFE8', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, fontSize: 16, color: '#0A2A1B' },
  btn: { width: '100%', backgroundColor: '#0F5132', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnAlt: { width: '100%', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnAltText: { color: '#0F5132', fontSize: 15, fontWeight: '600' },
  btnOut: { backgroundColor: '#C9A227', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 24 },
  btnOutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
