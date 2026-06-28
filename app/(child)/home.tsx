// app/(child)/home.tsx
// شاشة «الرئيسية» — اختيار الحكيم (المادّة). ستّة حكماء، لكلٍّ لونه وهويّته.
// النقر على بطاقة حكيم يفتح رحلة تلك المادّة (يمرّر subject عبر كل الشاشات).
// «الخط» بدل «القرآن» ضمن الحكماء الستة.

import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Hakeem from '../../components/Hakeem';
import { theme } from '../../config/theme';

// الحكماء الستة (تطابق مفاتيح subject في lesson.tsx وألوان الهالة).
const HAKEEMS: { subject: string; name: string; emoji: string; color: string }[] = [
  { subject: 'math', name: 'الرياضيات', emoji: '🔢', color: '#FF9F1C' },
  { subject: 'science', name: 'العلوم', emoji: '🔬', color: '#10B981' },
  { subject: 'english', name: 'الإنجليزية', emoji: '🔤', color: '#3B82F6' },
  { subject: 'arabic', name: 'العربية', emoji: '📖', color: '#8B5CF6' },
  { subject: 'calligraphy', name: 'الخط', emoji: '🖌️', color: '#0EA5E9' },
  { subject: 'creative', name: 'الإبداع', emoji: '🎨', color: '#EC4899' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const openHakeem = (subject: string) => {
    router.push({ pathname: '/(child)/journey', params: { childId, subject } });
  };

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Hakeem mood="happy" size={96} />
        <Text style={s.title}>مع مَن نتعلّم اليوم؟</Text>
        <Text style={s.sub}>اختر حكيمك وابدأ المغامرة</Text>
      </View>

      <View style={s.grid}>
        {HAKEEMS.map((h) => (
          <TouchableOpacity
            key={h.subject}
            activeOpacity={0.85}
            style={[s.card, { borderColor: h.color }]}
            onPress={() => openHakeem(h.subject)}
          >
            <View style={[s.iconCircle, { backgroundColor: h.color }]}>
              <Text style={s.icon}>{h.emoji}</Text>
            </View>
            <Text style={s.cardName}>{h.name}</Text>
            <Text style={[s.cardHint, { color: h.color }]}>حكيم {h.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { paddingHorizontal: theme.spacing.md },
  hero: { alignItems: 'center', marginBottom: 22, gap: 4 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark, marginTop: 8 },
  sub: { fontFamily: theme.fonts.bodyMed, fontSize: 14, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  card: {
    width: '47%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 2.5,
    paddingVertical: 22,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: { fontSize: 30 },
  cardName: { fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.textDark },
  cardHint: { fontFamily: theme.fonts.bodyBold, fontSize: 12, marginTop: 3 },
});
