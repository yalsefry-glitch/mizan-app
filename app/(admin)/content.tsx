// app/(admin)/content.tsx
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase, type Lesson, type IngestionJob } from '../../core/supabase';
import { theme } from '../../config/theme';

export default function ContentScreen() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadLessons();
    loadJobs();
    const interval = setInterval(loadJobs, 5000); // تحديث كل 5 ثوانٍ
    return () => clearInterval(interval);
  }, []);

  const loadLessons = async () => {
    const { data } = await supabase
      .from('lessons')
      .select('*')
      .order('part_number', { ascending: true, nullsFirst: false })
      .order('lesson_order', { ascending: true, nullsFirst: false })
      .limit(50);
    setLessons((data as Lesson[]) || []);
  };

  const loadJobs = async () => {
    const { data } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    setJobs((data as IngestionJob[]) || []);
  };

  const uploadBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file) return;

      setUploading(true);

      // رفع إلى Storage
      const fileName = `math-grade1-part1-${Date.now()}.pdf`;
      const filePath = `books/${fileName}`;

      const fileData = await fetch(file.uri);
      const blob = await fileData.blob();

      const { error: uploadError } = await supabase.storage
        .from('books')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // إنشاء مهمّة استيعاب
      // TODO: استخدم واجهة اختيار المادّة والصفّ والجزء
      const { error: jobError } = await supabase.from('ingestion_jobs').insert({
        file_path: filePath,
        subject_id: 'cbb340d9-ae4b-4de5-89b0-5572c3a9524d', // مادّة الرياضيات صف أول
        grade_id: '26ba396e-f8bc-4842-b7e4-a85ff3312ec5', // الصف الأول
        part_number: 1,
        status: 'pending',
      });

      if (jobError) throw jobError;

      Alert.alert('نجح', 'تمّ رفع الكتاب وبدء الاستيعاب');
      loadJobs();
    } catch (err: any) {
      Alert.alert('خطأ', err.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return theme.colors.success;
      case 'failed':
        return theme.colors.error;
      case 'processing':
        return theme.colors.primary;
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done':
        return '✓ تمّ';
      case 'failed':
        return '✗ فشل';
      case 'processing':
        return '⟳ يُعالَج';
      case 'pending':
        return '⏳ معلّق';
      default:
        return status;
    }
  };

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      <Text style={s.title}>إدارة المحتوى</Text>

      {/* رفع كتاب جديد */}
      <TouchableOpacity
        style={[s.uploadBtn, uploading && { opacity: 0.5 }]}
        onPress={uploadBook}
        disabled={uploading}
      >
        <Text style={s.uploadText}>
          {uploading ? '⏳ جارٍ الرفع...' : '📚 رفع كتاب جديد'}
        </Text>
      </TouchableOpacity>

      {/* قائمة المهامّ */}
      <Text style={s.sectionTitle}>مهامّ الاستيعاب</Text>
      {jobs.map((job) => {
        const progress = job.total_pages
          ? ((job.last_page_done / job.total_pages) * 100).toFixed(0)
          : 0;
        return (
          <View key={job.id} style={s.jobCard}>
            <View style={s.jobHeader}>
              <Text style={s.jobFile}>{job.file_path.split('/').pop()}</Text>
              <Text style={[s.jobStatus, { color: getStatusColor(job.status) }]}>
                {getStatusText(job.status)}
              </Text>
            </View>
            {job.total_pages && (
              <View style={s.progressBar}>
                <View style={[s.progressFill, { width: `${progress}%` as any }]} />
              </View>
            )}
            <View style={s.jobMeta}>
              <Text style={s.metaText}>
                {job.total_pages
                  ? `${job.last_page_done}/${job.total_pages} صفحة`
                  : 'جارٍ الكشف...'}
              </Text>
              <Text style={s.metaText}>
                {job.lessons_created} درس · {job.chunks_created} مقطع
              </Text>
            </View>
            {job.error_message && (
              <Text style={s.errorMsg}>{job.error_message}</Text>
            )}
          </View>
        );
      })}

      {/* قائمة الدروس */}
      <Text style={s.sectionTitle}>الدروس ({lessons.length})</Text>
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
  sectionTitle: { fontSize: 18, fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark, marginTop: 16 },
  uploadBtn: {
    padding: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadText: { fontSize: 16, fontFamily: theme.fonts.bodyBold, color: '#FFF' },
  jobCard: { padding: 14, backgroundColor: theme.colors.card, borderRadius: 10, gap: 8, marginBottom: 8 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobFile: { fontSize: 14, fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark, flex: 1 },
  jobStatus: { fontSize: 13, fontFamily: theme.fonts.bodyMed },
  progressBar: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary },
  jobMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontSize: 12, fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted },
  errorMsg: { fontSize: 11, fontFamily: theme.fonts.bodyMed, color: theme.colors.error },
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
