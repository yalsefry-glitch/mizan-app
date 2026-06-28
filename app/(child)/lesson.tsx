// app/(child)/lesson.tsx
// غرفة صوتية حيّة: أهمّ شاشة في التطبيق. الطفل في الصفّ الأول (٦ سنوات)
// لا يكتب ولا يلمس لوحة مفاتيح — كل التفاعل بالصوت واللمس فقط.
// حكيم في المنتصف بهالة نابضة بلون المادّة، ينطق ردّه (expo-speech)
// ويظهر النصّ حرفًا حرفًا، ثم يستمع تلقائيًّا (expo-speech-recognition).
// لا TextInput ولا لوحة مفاتيح ولا زرّ إرسال نصّي أبدًا.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
// حزمة اختيارية: قد لا تعمل على كل جهاز — كل استدعاء محاط بـ try/catch صامت.
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import YoutubeIframe from 'react-native-youtube-iframe';
import Hakeem, { type HakeemMood } from '../../components/Hakeem';
import { supabase } from '../../core/supabase';
import type { Lesson, Child } from '../../core/supabase';
import { tutorChat, type HakeemTurn } from '../../core/ai';
import { getAgeProfile } from '../../config/ageProfiles';
import { theme } from '../../config/theme';

// دور افتتاحي يبذر المحادثة بدور «طفل» حتى يبدأ سجلّ المحادثة بطلب الطفل
// (واجهة الرسائل ترفض أن يبدأ السجلّ بدور المساعد).
const OPENER: HakeemTurn = { role: 'child', text: 'ابدأ الدرس معي يا حكيم!' };

// لون الهالة حسب المادّة (هوية بصرية تميّز كل حكيم).
const SUBJECT_COLORS: Record<string, string> = {
  math: '#FF9F1C',
  science: '#10B981',
  english: '#3B82F6',
  arabic: '#8B5CF6',
  calligraphy: '#0EA5E9',
  creative: '#EC4899',
};

// تحويل Blob (صوت MP3 راجع من دالة tts) إلى رابط بيانات صالح لمشغّل expo-audio.
function blobToAudioUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('فشل قراءة الصوت'));
        return;
      }
      // result يأتي بصيغة data:application/octet-stream;base64,XXXX
      // نثبّت نوع MP3 صراحةً ليتعرّف عليه المشغّل.
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve(`data:audio/mpeg;base64,${base64}`);
    };
    reader.onerror = () => reject(reader.error ?? new Error('فشل قراءة الصوت'));
    reader.readAsDataURL(blob);
  });
}

// ===== مؤشّر الاستماع: أمواج صوتية متحرّكة (equalizer) =====
function ListeningWave({ color }: { color: string }) {
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 380, delay: i * 110, useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.35, duration: 380, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);
  return (
    <View style={s.wave}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={[s.waveBar, { backgroundColor: color, transform: [{ scaleY: b }] }]}
        />
      ))}
    </View>
  );
}

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId, lessonId, subject } = useLocalSearchParams<{
    childId: string;
    lessonId: string;
    subject: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [hakeemText, setHakeemText] = useState(''); // ردّ حكيم الكامل الحالي
  const [typed, setTyped] = useState(''); // الجزء الظاهر تدريجيًّا (typewriter)
  const [chips, setChips] = useState<string[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [complete, setComplete] = useState(false);
  const [fontScale, setFontScale] = useState(1.18);
  // جنس صوت حكيم (male افتراضيًّا). يُرسَل لدالة tts لاختيار الصوت.
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');

  // سياق الدرس وعمر الطفل (يُملأ بعد الجلب، يُستخدم في كل جولة).
  const ctx = useRef({ subject: 'math', title: '', content: '', tone: '', gradeOrder: 1, name: 'صديقي' });
  // سجلّ المحادثة الكامل (يُرسل كـ history لـ tutorChat). لا يُعرض كاملًا.
  const messagesRef = useRef<HakeemTurn[]>([OPENER]);
  // آخر نصّ سمعه حكيم من الطفل قبل إرساله.
  const heardRef = useRef('');
  // مرجع ثابت لأحدث نسخة من send (تستدعيه أحداث التعرّف الصوتي).
  const sendRef = useRef<(t: string) => void>(() => {});
  const scrollRef = useRef<ScrollView>(null);
  // مشغّل صوت ElevenLabs الحالي (نوقفه عند كل نطق جديد ومغادرة الشاشة).
  const playerRef = useRef<AudioPlayer | null>(null);

  const haloColor = SUBJECT_COLORS[subject || 'math'] || SUBJECT_COLORS.math;

  // ===== هالة نابضة حول حكيم =====
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.12] });

  // ===== التعرّف على الكلام (يبدأ تلقائيًّا بعد كلام حكيم) =====
  const startListening = useCallback(async () => {
    if (complete) return;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setListening(false);
        return; // البطاقات تبقى بديلًا دائمًا.
      }
      heardRef.current = '';
      ExpoSpeechRecognitionModule.start({
        lang: 'ar-SA',
        interimResults: true,
        continuous: false,
      });
      setListening(true);
    } catch {
      setListening(false); // البطاقات تبقى بديلًا دائمًا.
    }
  }, [complete]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // نتجاهل بصمت.
    }
    setListening(false);
  }, []);

  // ===== الاحتياط: نطق الجهاز المدمج (expo-speech) عند تعذّر صوت ElevenLabs =====
  const speakWithDevice = useCallback(
    (text: string, autoListen: boolean) => {
      try {
        Speech.stop();
        Speech.speak(text, {
          language: 'ar',
          onStart: () => setSpeaking(true),
          onDone: () => {
            setSpeaking(false);
            if (autoListen) startListening();
          },
          onStopped: () => setSpeaking(false),
          onError: () => setSpeaking(false),
        });
      } catch {
        setSpeaking(false);
        if (autoListen) startListening();
      }
    },
    [startListening]
  );

  // ===== إيقاف أي صوت جارٍ: مشغّل ElevenLabs + نطق الجهاز =====
  const stopSpeaking = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // نتجاهل بصمت.
    }
    if (playerRef.current) {
      try {
        playerRef.current.remove();
      } catch {
        // نتجاهل بصمت.
      }
      playerRef.current = null;
    }
    setSpeaking(false);
  }, []);

  // ===== النطق الصوتي: صوت ElevenLabs الفاخر عبر دالة tts، مع احتياط للجهاز =====
  const speak = useCallback(
    async (text: string, autoListen: boolean) => {
      if (!text) return;

      // أوقف أي صوت سابق (مشغّل أو نطق جهاز) قبل البدء.
      try {
        Speech.stop();
      } catch {
        // نتجاهل بصمت.
      }
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {
          // نتجاهل بصمت.
        }
        playerRef.current = null;
      }

      try {
        const { data, error } = await supabase.functions.invoke('tts', {
          body: { text, gender: voiceGender },
        });
        // الدالة تُرجع صوتًا ثنائيًّا (Blob). أي شيء آخر (خطأ/نصّ) → الاحتياط.
        if (error || !(data instanceof Blob)) throw error ?? new Error('لا يوجد صوت');

        const uri = await blobToAudioUri(data);
        try {
          await setAudioModeAsync({ playsInSilentMode: true });
        } catch {
          // وضع الصوت ليس حرجًا — نكمل.
        }

        const player = createAudioPlayer({ uri });
        playerRef.current = player;
        setSpeaking(true);
        player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (status.didJustFinish) {
            setSpeaking(false);
            if (playerRef.current === player) {
              try {
                player.remove();
              } catch {
                // نتجاهل بصمت.
              }
              playerRef.current = null;
            }
            if (autoListen) startListening();
          }
        });
        player.play();
      } catch {
        // أي فشل (شبكة، مفتاح، صيغة، عدم نشر tts) → نعود لنطق الجهاز صامتًا.
        speakWithDevice(text, autoListen);
      }
    },
    [voiceGender, startListening, speakWithDevice]
  );

  // ===== إرسال ردّ الطفل (صوتًا أو بطاقة) =====
  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || thinking || complete) return;

      stopListening();
      stopSpeaking();

      // لقطة السجلّ قبل إضافة ردّ الطفل (تُرسل كـ history).
      const history = messagesRef.current;
      messagesRef.current = [...history, { role: 'child', text: msg }];
      setChips([]);
      setThinking(true);

      const res = await tutorChat({
        subject: ctx.current.subject,
        lessonTitle: ctx.current.title,
        lessonContent: ctx.current.content,
        ageTone: ctx.current.tone,
        gradeOrder: ctx.current.gradeOrder,
        childName: ctx.current.name,
        history,
        childMessage: msg,
      });
      setThinking(false);

      if (res && res.reply) {
        messagesRef.current = [...messagesRef.current, { role: 'hakeem', text: res.reply }];
        setHakeemText(res.reply);
        setChips(res.suggestChips);
        if (res.lessonComplete) {
          setComplete(true);
          speak(res.reply, false);
        } else {
          speak(res.reply, true);
        }
      } else {
        const fallback = 'صار عندي عطل بسيط يا بطل، عيد لي وش قلت؟';
        setHakeemText(fallback);
        speak(fallback, true);
      }
    },
    [thinking, complete, stopListening, stopSpeaking, speak]
  );

  // أبقِ sendRef يشير دائمًا لأحدث نسخة (تستدعيها أحداث الصوت بأمان).
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // ===== أحداث التعرّف الصوتي =====
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript;
    if (t) heardRef.current = t;
  });
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const heard = heardRef.current.trim();
    heardRef.current = '';
    if (heard) sendRef.current(heard);
  });
  useSpeechRecognitionEvent('error', () => {
    setListening(false); // البطاقات تبقى بديلًا دائمًا.
  });

  // ===== تأثير الآلة الكاتبة: إظهار نصّ حكيم حرفًا حرفًا =====
  useEffect(() => {
    if (!hakeemText) {
      setTyped('');
      return;
    }
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(hakeemText.slice(0, i));
      if (i >= hakeemText.length) clearInterval(id);
    }, 38);
    return () => clearInterval(id);
  }, [hakeemText]);

  // ===== التمرير التلقائي لأسفل عند تغيّر المحتوى =====
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [typed, chips, complete, videoId]);

  // ===== جلب فيديو يوتيوب مناسب لعنوان الدرس =====
  useEffect(() => {
    if (!lesson?.title) return;
    supabase.functions
      .invoke('youtube-search', { body: { query: lesson.title } })
      .then(({ data }) => {
        if (data?.videoId) setVideoId(data.videoId);
      });
  }, [lesson?.title]);

  // ===== إيقاف الصوت والتعرّف عند مغادرة الشاشة =====
  useEffect(() => {
    return () => {
      try {
        Speech.stop();
      } catch {
        // نتجاهل بصمت.
      }
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {
          // نتجاهل بصمت.
        }
        playerRef.current = null;
      }
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // نتجاهل بصمت.
      }
    };
  }, []);

  // ===== الإقلاع: جلب الدرس + عمر الطفل، ثم بدء الحوار =====
  useEffect(() => {
    (async () => {
      if (!lessonId) {
        setLoading(false);
        return;
      }

      // جلب الدرس.
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      const ls = lessonData as Lesson | null;
      setLesson(ls);

      // جلب اسم الطفل وصفّه لتحديد النبرة وحجم الخطّ.
      let gradeOrder = 1;
      let name = 'صديقي';
      if (childId) {
        const { data: childData } = await supabase
          .from('children')
          .select('name, grade_id')
          .eq('id', childId)
          .single();
        const child = childData as Partial<Child> | null;
        if (child?.name) name = child.name;
        if (child?.grade_id) {
          const { data: gradeData } = await supabase
            .from('grades')
            .select('sort_order')
            .eq('id', child.grade_id)
            .single();
          if (gradeData?.sort_order) gradeOrder = gradeData.sort_order;
        }
      }
      const profile = getAgeProfile(gradeOrder);
      setFontScale(profile.fontScale);

      ctx.current = {
        subject: subject || 'math',
        title: ls?.title ?? 'الدرس',
        content: ls?.content_text ?? '',
        tone: profile.hakeemTone,
        gradeOrder,
        name,
      };

      // أوّل كلام من حكيم (سجلّ يبدأ بدور الطفل الافتتاحي).
      messagesRef.current = [OPENER];
      setLoading(false);
      setThinking(true);
      const res = await tutorChat({
        subject: ctx.current.subject,
        lessonTitle: ctx.current.title,
        lessonContent: ctx.current.content,
        ageTone: ctx.current.tone,
        gradeOrder: ctx.current.gradeOrder,
        childName: ctx.current.name,
        history: [OPENER],
        childMessage: '',
      });
      setThinking(false);
      if (res && res.reply) {
        messagesRef.current = [OPENER, { role: 'hakeem', text: res.reply }];
        setHakeemText(res.reply);
        setChips(res.suggestChips);
        if (res.lessonComplete) {
          setComplete(true);
          speak(res.reply, false);
        } else {
          speak(res.reply, true);
        }
      } else {
        const fallback = 'هلا والله يا بطل! يلّا نبدأ درسنا سوا، وش تحب نتعلّم اليوم؟';
        messagesRef.current = [OPENER, { role: 'hakeem', text: fallback }];
        setHakeemText(fallback);
        speak(fallback, true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, childId]);

  const goToReward = useCallback(() => {
    stopSpeaking();
    stopListening();
    router.replace({ pathname: '/(child)/reward', params: { childId } });
  }, [router, childId, stopSpeaking, stopListening]);

  // إعادة الاستماع عند لمس حكيم (بديل لمسي إن لم يبدأ الاستماع تلقائيًّا).
  const onTapHakeem = useCallback(() => {
    if (complete || thinking) return;
    if (listening) {
      stopListening();
    } else {
      stopSpeaking();
      startListening();
    }
  }, [complete, thinking, listening, stopListening, stopSpeaking, startListening]);

  const mood: HakeemMood = thinking ? 'think' : 'happy';

  if (loading) {
    return (
      <View style={s.center}>
        <Hakeem mood="think" size={120} />
        <Text style={s.loadingText}>حكيم يجهّز لك الدرس...</Text>
      </View>
    );
  }

  return (
    <View style={s.flex}>
      {/* رأس بسيط: رجوع + اسم حكيم */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>↩</Text>
        </TouchableOpacity>
        <Text style={s.headerName}>حكيم</Text>
        {/* زرّ تبديل جنس الصوت (ذكر/أنثى) — يُطبَّق على النطق التالي */}
        <TouchableOpacity
          onPress={() => setVoiceGender((g) => (g === 'male' ? 'female' : 'male'))}
          style={s.genderBtn}
          accessibilityLabel={voiceGender === 'male' ? 'صوت ذكوري' : 'صوت أنثوي'}
        >
          <Text style={s.genderIcon}>{voiceGender === 'male' ? '👦' : '👧'}</Text>
        </TouchableOpacity>
        {speaking ? (
          <TouchableOpacity onPress={stopSpeaking} style={s.muteBtn}>
            <Text style={s.muteIcon}>🔇</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.muteBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* حكيم في المنتصف داخل هالة نابضة بلون المادّة */}
        <TouchableOpacity activeOpacity={0.9} onPress={onTapHakeem} style={s.hakeemWrap}>
          <Animated.View
            style={[
              s.halo,
              {
                backgroundColor: haloColor,
                transform: [{ scale: haloScale }],
                opacity: haloOpacity,
              },
            ]}
          />
          <Hakeem mood={mood} size={150} />
        </TouchableOpacity>

        {/* مؤشّر الاستماع: أمواج + نصّ صغير */}
        {listening && (
          <View style={s.listenRow}>
            <ListeningWave color={haloColor} />
            <Text style={s.listenText}>حكيم يسمعك...</Text>
          </View>
        )}

        {/* فقاعة كلام حكيم (typewriter) */}
        {!!typed && (
          <View style={[s.bubble, { borderColor: haloColor }]}>
            <Text style={[s.bubbleText, { fontSize: 17 * fontScale }]}>{typed}</Text>
          </View>
        )}

        {/* مؤشّر «حكيم يفكّر...» */}
        {thinking && (
          <View style={s.thinkRow}>
            <ActivityIndicator size="small" color={theme.colors.primaryDark} />
            <Text style={s.thinkText}>حكيم يفكّر...</Text>
          </View>
        )}

        {/* مربّع فيديو يوتيوب (إن وُجد فيديو للدرس) */}
        {videoId && (
          <View style={s.videoBox}>
            <YoutubeIframe videoId={videoId} height={200} width={undefined} />
          </View>
        )}
      </ScrollView>

      {/* أسفل الشاشة: اكتمال الدرس أو بطاقات الاقتراحات */}
      {complete ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
          <Text style={s.celebrate}>🎉 أتقنت الدرس يا بطل!</Text>
          <TouchableOpacity style={[s.rewardBtn, { backgroundColor: haloColor }]} onPress={goToReward}>
            <Text style={s.rewardBtnText}>العب وكسب جواهر 💎</Text>
          </TouchableOpacity>
        </View>
      ) : (
        chips.length > 0 &&
        !thinking && (
          <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={s.chipsHint}>المس لتجاوب حكيم 👇</Text>
            <View style={s.chipsWrap}>
              {chips.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.chip, { borderColor: haloColor }]}
                  onPress={() => send(c)}
                  activeOpacity={0.8}
                >
                  <Text style={s.chipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )
      )}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    gap: 14,
  },
  loadingText: { fontFamily: theme.fonts.bodyBold, fontSize: 15, color: theme.colors.textBody },

  // الرأس
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 12,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 19, color: theme.colors.primaryDark },
  headerName: { flex: 1, fontFamily: theme.fonts.heading, fontSize: 19, color: theme.colors.textDark, textAlign: 'center' },
  muteBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  muteIcon: { fontSize: 20 },
  genderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderIcon: { fontSize: 20 },

  // الجسم
  body: { alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingTop: 18, gap: 18 },

  hakeemWrap: { alignItems: 'center', justifyContent: 'center', width: 220, height: 220 },
  halo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },

  // مؤشّر الاستماع
  listenRow: { alignItems: 'center', gap: 8 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34 },
  waveBar: { width: 6, height: 30, borderRadius: 3 },
  listenText: { fontFamily: theme.fonts.bodyBold, fontSize: 14, color: theme.colors.textDark },

  // فقاعة الكلام
  bubble: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 2.5,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  bubbleText: {
    fontFamily: theme.fonts.bodyMed,
    color: theme.colors.textBody,
    lineHeight: 32,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  // التفكير
  thinkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkText: { fontFamily: theme.fonts.bodyMed, color: theme.colors.textDark, fontSize: 14 },

  // الفيديو
  videoBox: {
    alignSelf: 'stretch',
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  // التذييل
  footer: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 14,
    paddingHorizontal: theme.spacing.md,
    gap: 12,
  },
  chipsHint: { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  chip: {
    minHeight: 60,
    minWidth: 130,
    backgroundColor: theme.colors.background,
    borderWidth: 2.5,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: theme.fonts.bodyBold, fontSize: 18, color: theme.colors.textDark, textAlign: 'center' },

  // الاكتمال
  celebrate: { fontFamily: theme.fonts.heading, fontSize: 19, color: theme.colors.textDark, textAlign: 'center' },
  rewardBtn: {
    borderRadius: theme.radius.md,
    padding: 18,
    alignItems: 'center',
  },
  rewardBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 18, color: theme.colors.white },
});
