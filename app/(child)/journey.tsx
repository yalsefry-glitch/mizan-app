// app/(child)/journey.tsx
// شاشة «الرحلة» — خريطة مسار متعرّجة (نمط Duolingo).
// الخطّ مرسوم بـSkia (في JourneyMap)، والمحطّات عناصر قابلة للنقر فوقه.
// كل محطّة = درس. النقر على المحطّة الحالية يفتح الدرس.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../core/supabase';
import type { Lesson } from '../../core/supabase';
import { theme } from '../../config/theme';

const STATION_SIZE = 84;
const V_GAP = 130;
const AMPLITUDE = 0.26;

interface StationData {
  lesson: Lesson;
  state: 'done' | 'current' | 'locked';
}

export default function JourneyScreen() {
  const router = useRouter();
  const { childId, subjectId, subject } = useLocalSearchParams<{
    childId: string;
    subjectId?: string;
    subject: string;
  }>();
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(true);

  const screenW = Dimensions.get('window').width - 32;
  const centerX = screenW / 2;

  useEffect(() => {
    (async () => {
      setLoading(true);

      // بوّابة الاكتمال: أي أجزاء هذه المادّة مكتملة 100% (coverage_complete=true) في book_status؟
      let completeParts: number[] = [];
      if (subjectId && subjectId !== '') {
        const { data: statusData } = await supabase
          .from('book_status')
          .select('part_number')
          .eq('subject_id', subjectId)
          .eq('coverage_complete', true);
        completeParts = ((statusData as { part_number: number }[] | null) ?? [])
          .map((r) => r.part_number)
          .filter((p): p is number => typeof p === 'number');
      }

      // حالة الفراغ: لا جزء مكتمل → لا محطّات (تُعرض شاشة «قيد التجهيز»).
      if (completeParts.length === 0) {
        setStations([]);
        setLoading(false);
        return;
      }

      // جلب الدروس الجاهزة (processed) للأجزاء المكتملة فقط، مرتّبة حسب part_number ثم lesson_order.
      let query = supabase
        .from('lessons')
        .select('*')
        .eq('status', 'processed')
        .in('part_number', completeParts);

      // تصفية حسب subject_id إن وُجد (UUID)
      if (subjectId && subjectId !== '') {
        query = query.eq('subject_id', subjectId);
      }

      const { data } = await query
        .order('part_number', { ascending: true, nullsFirst: false })
        .order('lesson_order', { ascending: true, nullsFirst: false });

      const lessons = (data ?? []) as Lesson[];
      // أوّل درس = الحالي، الباقي مقفل (يُفتح تباعًا لاحقًا حسب التقدّم).
      const built: StationData[] = lessons.map((lesson, i) => ({
        lesson,
        state: i === 0 ? 'current' : 'locked',
      }));
      setStations(built);
      setLoading(false);
    })();
  }, [childId, subjectId]);

  // حساب مواقع المحطّات (تعرّج جيبي).
  const positions = stations.map((_, i) => {
    const y = 40 + i * V_GAP;
    const offset = Math.sin(i * 0.9) * screenW * AMPLITUDE;
    return { x: centerX + offset, y };
  });

  // مسار Skia يصل المحطّات.
  const builder = Skia.PathBuilder.Make();
  positions.forEach((pt, i) => {
    if (i === 0) builder.moveTo(pt.x, pt.y);
    else {
      const prev = positions[i - 1];
      const midY = (prev.y + pt.y) / 2;
      builder.cubicTo(prev.x, midY, pt.x, midY, pt.x, pt.y);
    }
  });
  const path = builder.build();

  const totalH = stations.length * V_GAP + 80;

  const openStation = (st: StationData) => {
    if (st.state === 'locked') return;
    router.push({
      pathname: '/(child)/lesson',
      params: {
        childId,
        lessonId: st.lesson.id,
        subjectId: subjectId || '',
        subject: subject ?? 'math',
      },
    });
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // بوّابة الاكتمال: لا محطّات (لا جزء مكتمل بعد) → شاشة تجهيز ودودة.
  if (stations.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyIcon}>🪐</Text>
        <Text style={s.emptyText}>دروس هذا الكوكب قيد التجهيز... عد قريباً!</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.flex} contentContainerStyle={{ paddingTop: 54, paddingBottom: 40 }}>
      <Text style={s.title}>رحلة التعلّم</Text>

      <View style={{ width: screenW, height: totalH, alignSelf: 'center' }}>
        {/* الخطّ المنحني */}
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            path={path}
            style="stroke"
            strokeWidth={7}
            strokeCap="round"
            color={theme.colors.border}
          />
        </Canvas>

        {/* المحطّات */}
        {stations.map((st, i) => {
          const pos = positions[i];
          return (
            <TouchableOpacity
              key={st.lesson.id}
              activeOpacity={0.85}
              onPress={() => openStation(st)}
              style={[
                s.station,
                st.state === 'done' && s.stationDone,
                st.state === 'current' && s.stationCurrent,
                st.state === 'locked' && s.stationLocked,
                { left: pos.x - STATION_SIZE / 2, top: pos.y - STATION_SIZE / 2 },
              ]}
            >
              <Text style={s.stationIcon}>
                {st.state === 'done' ? '★' : st.state === 'current' ? '▶' : '🔒'}
              </Text>
              <Text style={s.stationLabel} numberOfLines={1}>
                {st.lesson.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  emptyIcon: { fontSize: 64, textAlign: 'center', marginBottom: 14 },
  emptyText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textBody,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 28,
  },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark, textAlign: 'center', marginBottom: 10 },
  station: {
    position: 'absolute',
    width: STATION_SIZE,
    height: STATION_SIZE,
    borderRadius: STATION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationDone: { backgroundColor: theme.colors.success },
  stationCurrent: { backgroundColor: theme.colors.primary },
  stationLocked: { backgroundColor: '#E5E7EB' },
  stationIcon: { fontSize: 30, color: theme.colors.white },
  stationLabel: {
    position: 'absolute',
    bottom: -22,
    width: 120,
    textAlign: 'center',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.textDark,
  },
});
