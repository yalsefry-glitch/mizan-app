// app/profiles.tsx
// شاشة اختيار الطفل: تعرض ملفّات الأطفال (حتّى ٤). الطفل يدخل بلمس
// ملفّه (لا مصادقة). كل ملفّ يُظهِر اسمه وصفّه ونقاطه.
// زرّ «وليّ الأمر» يفتح بوّابة الـPIN.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getChildren } from '../core/children';
import { getGrades } from '../core/children';
import type { Child, Grade } from '../core/supabase';
import { theme } from '../config/theme';

// ألوان ملفّات الأطفال (تدوير بصري لطيف).
const PROFILE_COLORS = [
  ['#FFD93D', '#FF9F1C'],
  ['#F9A8D4', '#EC4899'],
  ['#93C5FD', '#3B82F6'],
  ['#5EEAD4', '#0F766E'],
];

export default function ProfilesScreen() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [kids, gr] = await Promise.all([getChildren(), getGrades()]);
    setChildren(kids);
    setGrades(gr);
    setLoading(false);
  }, []);

  // إعادة التحميل عند العودة للشاشة (بعد إضافة طفل مثلًا).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const gradeName = (gradeId: string | null): string => {
    if (!gradeId) return 'بلا صفّ';
    return grades.find((g) => g.id === gradeId)?.name ?? 'بلا صفّ';
  };

  const pickChild = (child: Child) => {
    // الدخول لتجربة الطفل، مع تمرير معرّفه.
    router.push({ pathname: '/(child)/home', params: { childId: child.id } });
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Text style={s.title}>من سيتعلّم اليوم؟</Text>
      <Text style={s.sub}>اختر ملفّك</Text>

      <View style={s.grid}>
        {children.map((child, i) => {
          const colors = PROFILE_COLORS[i % PROFILE_COLORS.length];
          return (
            <TouchableOpacity
              key={child.id}
              style={s.profileCard}
              onPress={() => pickChild(child)}
              activeOpacity={0.85}
            >
              <View style={[s.avatar, { backgroundColor: colors[1] }]}>
                <Text style={s.avatarLetter}>{child.name.charAt(0)}</Text>
              </View>
              <Text style={s.name}>{child.name}</Text>
              <Text style={s.grade}>{gradeName(child.grade_id)}</Text>
              <View style={s.pointsPill}>
                <Text style={s.pointsText}>{child.points} نقطة</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {children.length < 4 && (
          <TouchableOpacity
            style={s.addCard}
            onPress={() => router.push('/(auth)/setup-children')}
            activeOpacity={0.85}
          >
            <Text style={s.addPlus}>+</Text>
            <Text style={s.addText}>إضافة طفل</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={s.parentGate}
        onPress={() => router.push('/(parent)/pin')}
      >
        <Text style={s.parentGateText}>لوحة وليّ الأمر</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1E293B' },
  center: {
    flex: 1,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { padding: theme.spacing.lg, paddingTop: 70, paddingBottom: 40 },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 24,
    color: theme.colors.white,
    textAlign: 'center',
  },
  sub: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  profileCard: {
    width: '46%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarLetter: {
    fontFamily: theme.fonts.heading,
    fontSize: 34,
    color: theme.colors.white,
  },
  name: {
    fontFamily: theme.fonts.headingMed,
    fontSize: 17,
    color: theme.colors.textDark,
  },
  grade: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pointsPill: {
    backgroundColor: '#FFF3E0',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },
  pointsText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.primaryDark,
  },
  addCard: {
    width: '46%',
    minHeight: 170,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: {
    fontFamily: theme.fonts.heading,
    fontSize: 40,
    color: 'rgba(255,255,255,0.5)',
  },
  addText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  parentGate: {
    marginTop: 28,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  parentGateText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    color: '#CBD5E1',
  },
});
