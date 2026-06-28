// app/(child)/lesson.tsx
// شاشة الحوار الحيّ: محادثة متعدّدة الجولات بين الطفل وحكيم.
// حكيم يبدأ بالشرح، ينطق ردّه صوتيًّا، يحاور ويكيّف حسب عمر الطفل،
// ولا يقول «صح/خطأ» أبدًا. حين يُتقن الطفل الدرس، تظهر دعوة للّعب والمكافأة.

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
// حزمة اختيارية: قد لا تعمل على كل جهاز — كل استدعاء محاط بـ try/catch صامت.
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import Hakeem from '../../components/Hakeem';
import { supabase } from '../../core/supabase';
import type { Lesson, Child } from '../../core/supabase';
import { tutorChat, type HakeemTurn } from '../../core/ai';
import { getAgeProfile } from '../../config/ageProfiles';
import { theme } from '../../config/theme';

// دور افتتاحي يبذر المحادثة بدور «طفل» حتى يبدأ سجلّ المحادثة بطلب الطفل
// (واجهة الرسائل ترفض أن يبدأ السجلّ بدور المساعد).
const OPENER: HakeemTurn = { role: 'child', text: 'ابدأ الدرس معي يا حكيم!' };

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId, lessonId } = useLocalSearchParams<{ childId: string; lessonId: string }>();

  const [loading, setLoading] = useState(true);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<HakeemTurn[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState('');
  const [complete, setComplete] = useState(false);
  const [fontScale, setFontScale] = useState(1.1);

  // سياق الدرس وعمر الطفل (يُملأ بعد الجلب، ويُستخدم في كل جولة).
  const ctx = useRef({ title: '', content: '', tone: '', gradeOrder: 1, name: 'صديقي' });
  const scrollRef = useRef<ScrollView>(null);

  // ===== النطق الصوتي (TTS) =====
  const speak = useCallback((text: string) => {
    if (!text) return;
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'ar',
        onStart: () => setSpeaking(true),
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch {
      setSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    try {
      Speech.stop();
    } catch {
      // نتجاهل بصمت.
    }
    setSpeaking(false);
  }, []);

  // ===== التعرّف على الكلام (اختياري) =====
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results?.[0]?.transcript;
    if (t) setInput(t);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => {
    setListening(false);
    setMicNote('ما فهمت عليك، اكتب لي يا بطل');
  });

  const toggleMic = useCallback(async () => {
    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // نتجاهل بصمت.
      }
      setListening(false);
      return;
    }
    setMicNote('');
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setMicNote('ما فهمت عليك، اكتب لي يا بطل');
        return;
      }
      stopSpeaking();
      ExpoSpeechRecognitionModule.start({
        lang: 'ar-SA',
        interimResults: true,
        continuous: false,
      });
      setListening(true);
    } catch {
      setListening(false);
      setMicNote('ما فهمت عليك، اكتب لي يا بطل');
    }
  }, [listening, stopSpeaking]);

  // ===== التمرير التلقائي لآخر رسالة =====
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, thinking, complete]);

  // ===== إيقاف الصوت والتعرّف عند مغادرة الشاشة =====
  useEffect(() => {
  useEffect(() => {
    if (!lesson?.title) return;
    supabase.functions.invoke("youtube-search", { body: { query: lesson.title } }).then(({ data }) => { if (data?.videoId) setVideoId(data.videoId); });
  }, [lesson?.title]);
    return () => {
      try {
        Speech.stop();
      } catch {
        // نتجاهل بصمت.
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
      let tone = '';
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
      tone = profile.hakeemTone;
      setFontScale(profile.fontScale);

      ctx.current = {
        title: ls?.title ?? 'الدرس',
        content: ls?.content_text ?? '',
        tone,
        gradeOrder,
        name,
      };

      // عرض الدور الافتتاحي ثم طلب أوّل كلام من حكيم.
      setMessages([OPENER]);
      setLoading(false);
      setThinking(true);
      const res = await tutorChat({
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
        setMessages([OPENER, { role: 'hakeem', text: res.reply }]);
        setChips(res.suggestChips);
        if (res.lessonComplete) setComplete(true);
        speak(res.reply);
      } else {
        const fallback = 'هلا والله يا بطل! يلّا نبدأ درسنا سوا، وش عندك تبي تعرف؟';
        setMessages([OPENER, { role: 'hakeem', text: fallback }]);
        speak(fallback);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, childId]);

  // ===== إرسال ردّ الطفل =====
  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || thinking || complete) return;

      // لقطة السجلّ قبل إضافة ردّ الطفل (تُرسل كـ history).
      const history = messages;
      setMessages((prev) => [...prev, { role: 'child', text: msg }]);
      setChips([]);
      setInput('');
      setMicNote('');
      setThinking(true);

      const res = await tutorChat({
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
        setMessages((prev) => [...prev, { role: 'hakeem', text: res.reply }]);
        setChips(res.suggestChips);
        if (res.lessonComplete) setComplete(true);
        speak(res.reply);
      } else {
        const fallback = 'صار عندي عطل بسيط يا بطل، عيد لي وش قلت؟';
        setMessages((prev) => [...prev, { role: 'hakeem', text: fallback }]);
        speak(fallback);
      }
    },
    [messages, thinking, complete, speak]
  );

  const goToReward = useCallback(() => {
    stopSpeaking();
    router.replace({ pathname: '/(child)/reward', params: { childId } });
  }, [router, childId, stopSpeaking]);

  if (loading) {
    return (
      <View style={s.center}>
        <Hakeem mood="think" size={120} />
        <Text style={s.loadingText}>حكيم يجهّز لك الدرس...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* رأس الشاشة */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>↩</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>
          {lesson?.title ?? 'الدرس'}
        </Text>
        {speaking ? (
          <TouchableOpacity onPress={stopSpeaking} style={s.muteBtn}>
            <Text style={s.muteIcon}>🔇</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.muteBtn} />
        )}
      </View>

      {/* منطقة الحوار */}
      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={s.chat}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, i) =>
          m.role === 'hakeem' ? (
            <View key={i} style={s.hakeemRow}>
              <Hakeem mood="happy" size={44} />
              <View style={s.hakeemBubble}>
                <Text style={[s.hakeemText, { fontSize: 15 * fontScale }]}>{m.text}</Text>
              </View>
            </View>
          ) : (
            <View key={i} style={s.childRow}>
              <View style={s.childBubble}>
                <Text style={[s.childText, { fontSize: 15 * fontScale }]}>{m.text}</Text>
              </View>
            </View>
          )
        )}

        {/* مؤشّر «حكيم يفكّر...» */}
        {thinking && (
          <View style={s.hakeemRow}>
            <Hakeem mood="think" size={44} />
            <View style={[s.hakeemBubble, s.thinkBubble]}>
              <ActivityIndicator size="small" color={theme.colors.primaryDark} />
              <Text style={s.thinkText}>حكيم يفكّر...</Text>
            </View>
          </View>
        )}
      </ScrollView>
      {videoId && <YoutubeIframe videoId={videoId} height={200} width={undefined} />}

      {/* اكتمال الدرس: احتفال + دعوة للّعب */}
      {complete ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={s.celebrate}>🎉 أتقنت الدرس يا بطل!</Text>
          <TouchableOpacity style={s.rewardBtn} onPress={goToReward}>
            <Text style={s.rewardBtnText}>العب وكسب جواهر 💎</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          {/* ملاحظة الميكروفون (تظهر عند تعذّر التعرّف) */}
          {!!micNote && <Text style={s.micNote}>{micNote}</Text>}

          {/* اقتراحات حكيم السريعة */}
          {chips.length > 0 && !thinking && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipsRow}
              keyboardShouldPersistTaps="handled"
            >
              {chips.map((c, i) => (
                <TouchableOpacity key={i} style={s.chip} onPress={() => send(c)}>
                  <Text style={s.chipText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* شريط الإدخال */}
          <View style={s.inputBar}>
            <TouchableOpacity
              style={[s.micBtn, listening && s.micBtnActive]}
              onPress={toggleMic}
            >
              <Text style={s.micIcon}>{listening ? '⏺' : '🎤'}</Text>
            </TouchableOpacity>

            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="اكتب لحكيم..."
              placeholderTextColor={theme.colors.textMuted}
              textAlign="right"
              multiline
              onSubmitEditing={() => send(input)}
              editable={!thinking}
            />

            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || thinking) && s.sendBtnOff]}
              onPress={() => send(input)}
              disabled={!input.trim() || thinking}
            >
              <Text style={s.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
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
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 19, color: theme.colors.primaryDark },
  title: { flex: 1, fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.textDark },
  muteBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  muteIcon: { fontSize: 20 },

  // الحوار
  chat: { padding: theme.spacing.md, paddingBottom: 24, gap: 14 },
  hakeemRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, alignSelf: 'flex-start', maxWidth: '88%' },
  hakeemBubble: {
    flexShrink: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    borderBottomLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  hakeemText: {
    fontFamily: theme.fonts.bodyMed,
    color: theme.colors.white,
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  thinkBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primaryLight },
  thinkText: { fontFamily: theme.fonts.bodyMed, color: theme.colors.textDark, fontSize: 13 },

  childRow: { alignSelf: 'flex-end', maxWidth: '88%' },
  childBubble: {
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  childText: {
    fontFamily: theme.fonts.bodyMed,
    color: theme.colors.textBody,
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  // التذييل
  footer: {
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
    paddingHorizontal: theme.spacing.md,
    gap: 8,
  },
  micNote: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.error, textAlign: 'right' },

  chipsRow: { gap: 8, paddingBottom: 2, flexDirection: 'row' },
  chip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipText: { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.primaryDark },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: theme.fonts.bodyMed,
    fontSize: 15,
    color: theme.colors.textBody,
    writingDirection: 'rtl',
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: { backgroundColor: theme.colors.errorBg },
  micIcon: { fontSize: 20 },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { backgroundColor: theme.colors.primaryLight, opacity: 0.6 },
  sendIcon: { fontSize: 18, color: theme.colors.white, transform: [{ scaleX: -1 }] },

  // الاكتمال
  celebrate: { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.textDark, textAlign: 'center' },
  rewardBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    padding: 16,
    alignItems: 'center',
  },
  rewardBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.white },
});
import YoutubeIframe from 'react-native-youtube-iframe';
