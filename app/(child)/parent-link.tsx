// app/(child)/parent-link.tsx
// تبويب «الآباء» داخل تجربة الطفل. لا يعرض بيانات — فقط يوجّه لبوّابة
// الرقم السرّي (PIN) لحماية لوحة وليّ الأمر من وصول الطفل.

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Hakeem from '../../components/Hakeem';
import { theme } from '../../config/theme';

export default function ParentLinkScreen() {
  const router = useRouter();

  return (
    <View style={s.container}>
      <Hakeem mood="idle" size={120} />
      <Text style={s.title}>لوحة وليّ الأمر</Text>
      <Text style={s.sub}>
        هذا القسم لوليّ الأمر فقط. يتطلّب الرقم السرّي لمتابعة تقدّم الأطفال.
      </Text>

      <TouchableOpacity style={s.btn} onPress={() => router.push('/(parent)/pin')}>
        <Text style={s.btnText}>فتح بالرقم السرّي</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace('/profiles')}>
        <Text style={s.switchProfile}>تبديل الطفل</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: 14,
  },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark },
  sub: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 15,
    paddingHorizontal: 36,
  },
  btnText: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.white },
  switchProfile: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: theme.colors.primaryDark,
    marginTop: 8,
  },
});
