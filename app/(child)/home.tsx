// app/(child)/home.tsx
// شاشة «الرئيسية» — اختيار الحكيم (المادّة). ستّة حكماء، لكلٍّ لونه وهويّته.
// النقر على بطاقة حكيم يفتح رحلة تلك المادّة (يمرّر subject_id UUID + subject key).
// «الخط» بدل «القرآن» ضمن الحكماء الستة.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Hakeem from '../../components/Hakeem';
import GlassCard from '../../components/GlassCard';
import { supabase, type HakeemEntry, type Child, type Subject } from '../../core/supabase';
import { theme } from '../../config/theme';

// نموذج عرض موحّد للبطاقة (يدمج بيانات hakeem + subject).
interface HakeemCard {
  subjectId: string;    // UUID من subjects table
  subjectKey: string;   // مفتاح المادة (math, science, ...)
  name: string;
  emoji: string;
  color: string;
}

// احتياط متدرّج: إن تعذّرت قراءة الجدول (شبكة/جلسة) لا تنهار الشاشة، بل
// تعرض الحكماء الستة من قائمة مدمجة (فلسفة الأصول المرنة).
const FALLBACK_HAKEEMS: HakeemCard[] = [
  { subjectId: '', subjectKey: 'math', name: 'الرياضيات', emoji: '🔢', color: '#FF9F1C' },
  { subjectId: '', subjectKey: 'science', name: 'العلوم', emoji: '🔬', color: '#10B981' },
  { subjectId: '', subjectKey: 'english', name: 'الإنجليزية', emoji: '🔤', color: '#3B82F6' },
  { subjectId: '', subjectKey: 'arabic', name: 'العربية', emoji: '📖', color: '#8B5CF6' },
  { subjectId: '', subjectKey: 'calligraphy', name: 'الخط', emoji: '🖌️', color: '#0EA5E9' },
  { subjectId: '', subjectKey: 'creative', name: 'الإبداع', emoji: '🎨', color: '#EC4899' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const [hakeems, setHakeems] = useState<HakeemCard[]>(FALLBACK_HAKEEMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // جلب بيانات الطفل للحصول على grade_id
        const { data: child } = await supabase
          .from('children')
          .select('grade_id')
          .eq('id', childId)
          .single();

        const gradeId = (child as Child | null)?.grade_id;

        // جلب hakeems (للعرض البصري)
        const { data: hakeemData } = await supabase
          .from('hakeems')
          .select('key, name_ar, color, emoji, sort_order')
          .order('sort_order', { ascending: true });

        const hakeemRows = (hakeemData as Pick<HakeemEntry, 'key' | 'name_ar' | 'color' | 'emoji'>[] | null) ?? [];

        // جلب subjects المرتبطة بصف الطفل
        let subjectRows: Pick<Subject, 'id' | 'name' | 'subject_key'>[] = [];
        if (gradeId) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('id, name, subject_key')
            .eq('grade_id', gradeId);
          subjectRows = (subjectData as Pick<Subject, 'id' | 'name' | 'subject_key'>[] | null) ?? [];
        }

        // المواد التي لها كتاب مكتمل 100% (coverage_complete=true) في book_status.
        // بوّابة صارمة: لا تُعرض مادّة للطفل ما لم يكتمل كتابها بالكامل.
        const completeSubjectIds = new Set<string>();
        if (subjectRows.length > 0) {
          const subjectIds = subjectRows.map((sub) => sub.id);
          const { data: statusData } = await supabase
            .from('book_status')
            .select('subject_id')
            .in('subject_id', subjectIds)
            .eq('coverage_complete', true);
          for (const row of (statusData as { subject_id: string }[] | null) ?? []) {
            completeSubjectIds.add(row.subject_id);
          }
        }

        if (!active) return;

        // دمج hakeems مع subjects — فقط للمواد التي لها كتاب مكتمل
        const merged: HakeemCard[] = [];
        for (const h of hakeemRows) {
          const matchedSubject = subjectRows.find(s => s.subject_key === h.key);
          // شرط صارم: لا نعرض بطاقة حكيم لمادة بلا كتاب مكتمل
          if (!matchedSubject || !completeSubjectIds.has(matchedSubject.id)) continue;
          merged.push({
            subjectId: matchedSubject.id,
            subjectKey: h.key,
            name: h.name_ar,
            emoji: h.emoji ?? '✨',
            color: h.color,
          });
        }

        if (merged.length > 0) {
          setHakeems(merged);
        }
      } catch {
        // عند الخطأ نبقي الاحتياط — الشاشة لا تنهار أبدًا
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [childId]);

  // طفو ناعم لبومة حكيم في الترويسة (إحساس حيّ راقٍ ٢٠٢٦).
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [floatY]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  const openHakeem = (h: HakeemCard) => {
    router.push({
      pathname: '/(child)/journey',
      params: {
        childId,
        subjectId: h.subjectId,
        subject: h.subjectKey, // احتياط للتوافق
      },
    });
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(600)} style={s.heroWrap}>
        <GlassCard
          width={width - theme.spacing.md * 2}
          height={196}
          glow={theme.colors.primary}
          radius={theme.radius.xl}
          padding={16}
        >
          <View style={s.hero}>
            <Animated.View style={floatStyle}>
              <Hakeem mood="happy" size={92} />
            </Animated.View>
            <Text style={s.title}>مع مَن نتعلّم اليوم؟</Text>
            <Text style={s.sub}>اختر حكيمك وابدأ المغامرة</Text>
          </View>
        </GlassCard>
      </Animated.View>

      <View style={s.grid}>
        {hakeems.map((h, i) => (
          <Animated.View
            key={h.subjectKey}
            entering={FadeInDown.delay(i * 90).duration(520).springify().damping(14)}
            style={[s.cardWrap, { shadowColor: h.color }]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={[s.card, { borderColor: h.color }]}
              onPress={() => openHakeem(h)}
            >
              {/* تدرّج خافت بلون المادّة (إحساس زجاجيّ ٢٠٢٦) */}
              <LinearGradient
                colors={[`${h.color}26`, `${h.color}08`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[s.iconCircle, { backgroundColor: h.color, shadowColor: h.color }]}>
                <Text style={s.icon}>{h.emoji}</Text>
              </View>
              <Text style={s.cardName}>{h.name}</Text>
              <Text style={[s.cardHint, { color: h.color }]}>حكيم {h.name}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingHorizontal: theme.spacing.md },
  heroWrap: { alignItems: 'center', marginBottom: 22 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark, marginTop: 8 },
  sub: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  // غلاف الحركة + الظلّ الملوّن (زوايا كبيرة ٢٠٢٦).
  cardWrap: {
    width: '47%',
    marginBottom: 16,
    borderRadius: theme.radius.xl,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 2.5,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  icon: { fontSize: 30 },
  cardName: { fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.textDark },
  cardHint: { fontFamily: theme.fonts.bodyBold, fontSize: 12, marginTop: 3 },
});
