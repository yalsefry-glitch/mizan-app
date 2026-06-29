// app/(admin)/content.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, type Lesson } from '../../core/supabase';
import { theme } from '../../config/theme';

export default function ContentScreen() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('lessons')
        .select('*')
        .order('part_number', { ascending: true, nullsFirst: false })
        .order('lesson_order', { ascending: true, nullsFirst: false })
        .limit(50);
      setLessons((data as Lesson[]) || []);
    })();
  }, []);

  const ingestMathBook = async () => {
    setIngesting(true);
    try {
      // استدعاء ingest-pdf بوضع book
      // ملاحظة: يحتاج رابط الملف الفعلي
      Alert.alert(
        'استيعاب كتاب',
        'الميزة قيد التطوير. استخدم Codespace لرفع الكتاب واستيعابه عبر:\n\ncurl -X POST [URL] -d \'{"mode":"book","fileUrl":"..."}\'',
        [{ text: 'حسناً' }]
      );
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setIngesting(false);
    }
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Text style={s.title}>إدارة المحتوى</Text>
      <Text style={s.count}>الدروس المستوعَبة: {lessons.length}</Text>

      <TouchableOpacity
        style={[s.ingestBtn, ingesting && { opacity: 0.5 }]}
        onPress={ingestMathBook}
        disabled={ingesting}
      >
        <Text style={s.ingestText}>
          {ingesting ? '⏳ جارٍ الاستيعاب...' : '📚 استوعب كتاباً جديداً'}
        </Text>
      </TouchableOpacity>

      {lessons.map((l) => (
        <View key={l.id} style={s.card}>
          <Text style={s.name}>{l.title}</Text>
          <View style={s.meta}>
            {l.chapter_number && (
              <Text style={s.chapter}>الفصل {l.chapter_number}</Text>
            )}
            {l.lesson_type && l.lesson_type !== 'lesson' && (
              <Text style={s.type}>
                {l.lesson_type === 'test_mid' && '📝 اختبار منتصف'}
                {l.lesson_type === 'test_chapter' && '📝 اختبار فصل'}
                {l.lesson_type === 'test_cumulative' && '📝 تراكمي'}
                {l.lesson_type === 'intro' && '📖 تهيئة'}
              </Text>
            )}
          </View>
          <Text style={[s.status, l.status === 'processed' && { color: theme.colors.success }]}>
            {l.status === 'processed' ? '✓ جاهز' : 'معلّق'}
          </Text>
          {l.part_number && <Text style={s.part}>الجزء {l.part_number}</Text>}
          {l.lesson_order && <Text style={s.order}>#{l.lesson_order}</Text>}
        </View>
      ))}
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={s.back}>← رجوع</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 20, gap: 10 },
  title: { fontSize: 22, fontFamily: theme.fonts.heading, color: theme.colors.textDark },
  count: { fontSize: 14, fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted, marginBottom: 6 },
  ingestBtn: {
    padding: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  ingestText: { fontSize: 16, fontFamily: theme.fonts.bodyBold, color: '#FFF' },
  card: { padding: 12, backgroundColor: theme.colors.card, borderRadius: 10, gap: 4 },
  name: { fontSize: 15, fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark },
  meta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chapter: { fontSize: 11, fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted },
  type: { fontSize: 11, fontFamily: theme.fonts.bodyMed, color: theme.colors.gem },
  status: { fontSize: 13, fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted },
  part: { fontSize: 12, fontFamily: theme.fonts.bodyMed, color: theme.colors.primary },
  order: { fontSize: 11, fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted },
  back: { fontSize: 16, fontFamily: theme.fonts.bodyBold, color: theme.colors.textMuted, textAlign: 'center', marginTop: 10 },
});
