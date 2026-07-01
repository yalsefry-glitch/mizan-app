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
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getChildren, getGrades, updateChildGrade, removeChild } from '../core/children';
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
  const [promotingChild, setPromotingChild] = useState<Child | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handlePromote = (child: Child) => {
    setPromotingChild(child);
  };

  const handlePromoteGrade = async (gradeId: string) => {
    if (!promotingChild) return;
    setError(null);
    try {
      const success = await updateChildGrade(promotingChild.id, gradeId);
      if (success) {
        setPromotingChild(null);
        await load(); // إعادة تحميل القائمة لإظهار الصف الجديد
      } else {
        setError('حدث خطأ في الترقية. حاول مرة أخرى');
      }
    } catch (err) {
      console.error('[profiles] ترقية:', err);
      setError('حدث خطأ في الترقية. حاول مرة أخرى');
    }
  };

  const handleDelete = (child: Child) => {
    Alert.alert(
      `حذف ملف ${child.name}؟`,
      'لا يمكن التراجع عن هذه العملية',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const success = await removeChild(child.id);
            if (success) {
              await load(); // إعادة تحميل القائمة
            }
          },
        },
      ]
    );
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
            <View key={child.id} style={s.profileCard}>
              <TouchableOpacity
                style={s.cardContent}
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

              {/* أيقونات الترقية والحذف */}
              <View style={s.cardActions}>
                <TouchableOpacity
                  style={s.iconBtn}
                  onPress={() => handlePromote(child)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ribbon" size={22} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.iconBtn}
                  onPress={() => handleDelete(child)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash" size={22} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            </View>
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

      {/* Modal ترقية الصف */}
      <Modal
        visible={!!promotingChild}
        transparent
        animationType="fade"
        onRequestClose={() => setPromotingChild(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>
              ترقية {promotingChild?.name ?? ''}
            </Text>
            <Text style={s.modalSub}>اختر الصف الجديد:</Text>

            {error && <Text style={s.errorText}>{error}</Text>}

            <View style={s.gradesGrid}>
              {grades.map((grade) => {
                const isCurrent = grade.id === promotingChild?.grade_id;
                return (
                  <TouchableOpacity
                    key={grade.id}
                    style={[s.gradeBtn, isCurrent && s.gradeBtnCurrent]}
                    onPress={() => handlePromoteGrade(grade.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.gradeBtnText, isCurrent && s.gradeBtnTextCurrent]}>
                      {grade.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => {
                setPromotingChild(null);
                setError(null);
              }}
            >
              <Text style={s.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    position: 'relative',
  },
  cardContent: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  cardActions: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSub: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    fontFamily: theme.fonts.bodyMed,
    fontSize: 13,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  gradesGrid: {
    gap: 12,
    marginBottom: 20,
  },
  gradeBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradeBtnCurrent: {
    backgroundColor: theme.colors.primaryLight + '22',
    borderColor: theme.colors.primary,
  },
  gradeBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  gradeBtnTextCurrent: {
    color: theme.colors.primary,
  },
  cancelBtn: {
    backgroundColor: '#F3F4F6',
    borderRadius: theme.radius.md,
    padding: 14,
  },
  cancelBtnText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 15,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});
