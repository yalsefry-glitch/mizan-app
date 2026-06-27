// app/(parent)/dashboard.tsx
// لوحة وليّ الأمر التحليلية (Mission Control). تقرأ child_analytics View،
// تعرض بطاقات رؤى لكل طفل (نجاح، سلسلة، نشاط)، وتولّد بطاقة إنجاز
// فاخرة قابلة للمشاركة (Viral Loop).

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../core/supabase';
import { theme } from '../../config/theme';

interface ChildAnalytics {
  child_id: string;
  child_name: string;
  gems: number;
  success_rate: number;
  quizzes_taken: number;
  current_streak: number;
  weather: string;
  gems_last_week: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<ChildAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareChild, setShareChild] = useState<ChildAnalytics | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('child_analytics').select('*');
      setRows((data ?? []) as ChildAnalytics[]);
      setLoading(false);
    })();
  }, []);

  // توليد جملة الرؤية الذكية (تفسير محلّي للأرقام).
  const insight = (c: ChildAnalytics): { tag: string; color: string; text: string } => {
    if (c.quizzes_taken === 0) {
      return { tag: 'بداية', color: theme.colors.textMuted, text: `${c.child_name} لم يبدأ التمارين بعد. شجّعه على أوّل درس!` };
    }
    if (c.success_rate >= 0.8) {
      return { tag: 'تفوّق', color: theme.colors.success, text: `${c.child_name} يتقن المادة بنسبة ${Math.round(c.success_rate * 100)}٪ — أداء ممتاز! وُجّه حكيم لرفع التحدّي.` };
    }
    if (c.success_rate < 0.5) {
      return { tag: 'يحتاج دعمًا', color: theme.colors.error, text: `${c.child_name} يواجه صعوبة (نجاح ${Math.round(c.success_rate * 100)}٪). وُجّه حكيم لتكثيف التمارين الأساسية.` };
    }
    return { tag: 'تقدّم', color: theme.colors.primaryDark, text: `${c.child_name} يتقدّم بثبات (${Math.round(c.success_rate * 100)}٪). الاستمرارية مفتاح التحسّن.` };
  };

  const generateShare = async (c: ChildAnalytics) => {
    setShareChild(c);
  };

  const doShare = async (c: ChildAnalytics) => {
    try {
      await Share.share({
        message: `🦉 عالم حكيم: ${c.child_name} حقّق ${c.gems} جوهرة وسلسلة ${c.current_streak} أيام بمساعدة الذكاء الاصطناعي! 🌟`,
      });
    } catch {
      // تجاهل إلغاء المشاركة.
    }
    setShareChild(null);
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
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace('/profiles')} style={s.backBtn}>
          <Text style={s.backIcon}>↩</Text>
        </TouchableOpacity>
        <Text style={s.title}>لوحة وليّ الأمر</Text>
      </View>
      <Text style={s.subtitle}>متابعة ذكية لتقدّم أطفالك</Text>

      {rows.length === 0 && (
        <Text style={s.empty}>لا توجد بيانات بعد. سيظهر تحليل كل طفل بعد أوّل نشاط.</Text>
      )}

      {rows.map((c) => {
        const ins = insight(c);
        return (
          <View key={c.child_id} style={[s.card, { borderRightColor: ins.color }]}>
            <View style={s.cardTop}>
              <Text style={s.childName}>{c.child_name}</Text>
              <View style={[s.tag, { backgroundColor: ins.color + '22' }]}>
                <Text style={[s.tagText, { color: ins.color }]}>{ins.tag}</Text>
              </View>
            </View>

            <Text style={s.insightText}>{ins.text}</Text>

            {/* مؤشّرات سريعة */}
            <View style={s.kpiRow}>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{c.gems}</Text>
                <Text style={s.kpiLabel}>جوهرة</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{c.current_streak}</Text>
                <Text style={s.kpiLabel}>سلسلة</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{Math.round(c.success_rate * 100)}٪</Text>
                <Text style={s.kpiLabel}>نجاح</Text>
              </View>
              <View style={s.kpi}>
                <Text style={s.kpiNum}>{c.gems_last_week}</Text>
                <Text style={s.kpiLabel}>هذا الأسبوع</Text>
              </View>
            </View>

            {c.success_rate >= 0.8 && (
              <TouchableOpacity style={s.shareBtn} onPress={() => generateShare(c)}>
                <Text style={s.shareBtnText}>توليد بطاقة الإنجاز للمشاركة</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* البطاقة الفيروسية */}
      <Modal visible={!!shareChild} transparent animationType="fade">
        <View style={s.overlay}>
          {shareChild && (
            <>
              <View style={s.shareCard}>
                <Text style={s.shareLogo}>🦉 عالم حكيم</Text>
                <Text style={s.shareMedal}>🏅</Text>
                <Text style={s.shareHeadline}>
                  حكيم يهنّئ {shareChild.child_name} على تفوّقه!
                </Text>
                <Text style={s.shareSub}>
                  أتقن المادة بنسبة {Math.round(shareChild.success_rate * 100)}٪ بمساعدة الذكاء الاصطناعي
                </Text>
                <View style={s.shareStats}>
                  <View style={s.shareStat}>
                    <Text style={s.shareStatNum}>{shareChild.gems}</Text>
                    <Text style={s.shareStatLabel}>جوهرة</Text>
                  </View>
                  <View style={s.shareStat}>
                    <Text style={s.shareStatNum}>{shareChild.current_streak}</Text>
                    <Text style={s.shareStatLabel}>يوم متتالٍ</Text>
                  </View>
                </View>
              </View>
              <View style={s.shareActions}>
                <TouchableOpacity style={s.waBtn} onPress={() => doShare(shareChild)}>
                  <Text style={s.waBtnText}>مشاركة</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.closeBtn} onPress={() => setShareChild(null)}>
                  <Text style={s.closeBtnText}>إغلاق</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md, paddingTop: 54, paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 19, color: theme.colors.primaryDark },
  title: { fontFamily: theme.fonts.heading, fontSize: 21, color: theme.colors.textDark },
  subtitle: { fontFamily: theme.fonts.bodyMed, fontSize: 13, color: theme.colors.textMuted, marginTop: 4, marginBottom: 18 },
  empty: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: 14, borderRightWidth: 5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  childName: { fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.textDark },
  tag: { borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: theme.fonts.bodyBold, fontSize: 11 },
  insightText: { fontFamily: theme.fonts.bodyMed, fontSize: 13, color: theme.colors.textBody, lineHeight: 22, marginBottom: 14 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kpi: { alignItems: 'center' },
  kpiNum: { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.primaryDark },
  kpiLabel: { fontFamily: theme.fonts.bodyMed, fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  shareBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', marginTop: 14 },
  shareBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 14, color: theme.colors.white },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  shareCard: { width: '100%', borderRadius: theme.radius.xl, padding: 28, backgroundColor: '#7C3AED', alignItems: 'center' },
  shareLogo: { fontFamily: theme.fonts.headingMed, fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 16 },
  shareMedal: { fontSize: 56, marginBottom: 10 },
  shareHeadline: { fontFamily: theme.fonts.heading, fontSize: 21, color: theme.colors.white, textAlign: 'center', lineHeight: 32, marginBottom: 8 },
  shareSub: { fontFamily: theme.fonts.bodyMed, fontSize: 13, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22 },
  shareStats: { flexDirection: 'row', gap: 40, marginTop: 20, paddingTop: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  shareStat: { alignItems: 'center' },
  shareStatNum: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.white },
  shareStatLabel: { fontFamily: theme.fonts.bodyMed, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  shareActions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  waBtn: { flex: 1, backgroundColor: '#25D366', borderRadius: theme.radius.md, padding: 14, alignItems: 'center' },
  waBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 15, color: theme.colors.white },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.radius.md, padding: 14, paddingHorizontal: 20, alignItems: 'center' },
  closeBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 15, color: theme.colors.white },
});
