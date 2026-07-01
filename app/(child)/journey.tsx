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
  Animated,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
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

// مكوّن المحطة الحالية — دائرة ذهبية نابضة
function CurrentStation({ size }: { size: number }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.12, { duration: 800 }), -1, true);
  }, []);

  return (
    <Reanimated.View
      style={[
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.gold,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={{ fontSize: 32, color: '#7A5900' }}>▶</Text>
    </Reanimated.View>
  );
}

// مكوّن المحطة المكتملة — نجمة 3D أو بديل
function DoneStation({ size }: { size: number }) {
  const [imageFailed, setImageFailed] = useState(false);

  try {
    if (!imageFailed) {
      return (
        <Image
          source={require('../../assets/images/nodes/star-3d.png')}
          style={{ width: size, height: size }}
          contentFit="contain"
          onError={() => setImageFailed(true)}
        />
      );
    }
  } catch {
    // الملف غائب — نستخدم البديل
  }

  // البديل
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 36 }}>⭐</Text>
    </View>
  );
}

// مكوّن المحطة المقفلة — زجاجية مع قفل 3D أو بديل
function LockedStation({ size, triggerShake }: { size: number; triggerShake?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const translateX = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    if (triggerShake) {
      translateX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-4, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [triggerShake]);

  let content;
  try {
    if (!imageFailed) {
      content = (
        <Image
          source={require('../../assets/images/nodes/lock-3d.png')}
          style={{ width: size * 0.5, height: size * 0.5 }}
          contentFit="contain"
          onError={() => setImageFailed(true)}
        />
      );
    } else {
      content = <Text style={{ fontSize: 32, opacity: 0.85 }}>🔒</Text>;
    }
  } catch {
    content = <Text style={{ fontSize: 32, opacity: 0.85 }}>🔒</Text>;
  }

  return (
    <Reanimated.View
      style={[
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF22',
          borderWidth: 1.5,
          borderColor: '#FFFFFF55',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      {content}
    </Reanimated.View>
  );
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
  const [shakeLockedId, setShakeLockedId] = useState<string | null>(null);

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
    if (st.state === 'locked') {
      // اهتزاز + haptics للمحطة المقفلة
      setShakeLockedId(st.lesson.id);
      setTimeout(() => setShakeLockedId(null), 200);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
      return;
    }

    // haptics خفيف للمحطة المكتملة
    if (st.state === 'done') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

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
    <LinearGradient
      colors={[theme.colors.backgroundDay, '#FFF3E0']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 54, paddingBottom: 40 }}>
        <Text style={s.title}>رحلة التعلّم</Text>

        <View style={{ width: screenW, height: totalH, alignSelf: 'center' }}>
          {/* الخطّ المنحني */}
          <Canvas style={StyleSheet.absoluteFill}>
            <Path
              path={path}
              style="stroke"
              strokeWidth={8}
              strokeCap="round"
              color="#FFD700"
            />
          </Canvas>

          {/* المحطّات */}
          {stations.map((st, i) => {
            const pos = positions[i];
            const size =
              st.state === 'current' ? 88 : st.state === 'done' ? 76 : 72;

            return (
              <TouchableOpacity
                key={st.lesson.id}
                activeOpacity={0.85}
                onPress={() => openStation(st)}
                style={[
                  s.station,
                  { left: pos.x - size / 2, top: pos.y - size / 2 },
                ]}
              >
                {st.state === 'current' && <CurrentStation size={size} />}
                {st.state === 'done' && <DoneStation size={size} />}
                {st.state === 'locked' && (
                  <LockedStation
                    size={size}
                    triggerShake={shakeLockedId === st.lesson.id}
                  />
                )}
                <View style={s.labelContainer}>
                  <Text style={s.stationLabel} numberOfLines={1}>
                    {st.lesson.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  emptyIcon: { fontSize: 64, textAlign: 'center', marginBottom: 14 },
  emptyText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 17,
    color: theme.colors.textBody,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 28,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: 10
  },
  station: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    bottom: -26,
    width: 120,
    backgroundColor: '#FFFFFFEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
  },
  stationLabel: {
    textAlign: 'center',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    color: '#3A2A1A',
  },
});
