import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useLang } from '../theme/LanguageContext';
import { supabase } from '../lib/supabase';

const FN_URL = 'https://lzfgjvafmvofwjiyvelq.supabase.co/functions/v1/rapid-function';

// مفتاح حفظ المحادثة محليّاً على الجهاز (لكل مساعد محادثته الخاصّة).
// الحفظ محلّي فقط: لا تُرسل المحادثات لأي خادم، حفاظاً على الخصوصية ومبدأ Zero Evidence.
const convKey = (id) => `mizan_conv_${id || 'orchestrator'}`;

// يزيل رموز التنسيق (#، *، _، `) من ردّ المساعد ليظهر النصّ نظيفاً.
function cleanReply(text) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim()); // كتل الشيفرة
  out = out.replace(/`([^`]+)`/g, '$1');      // علامات الكود المفردة
  out = out.replace(/^#{1,6}\s+/gm, '');       // عناوين #
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1'); // **عريض**
  out = out.replace(/\*([^*]+)\*/g, '$1');      // *مائل*
  out = out.replace(/__([^_]+)__/g, '$1');      // __تأكيد__
  out = out.replace(/^\s*[-*+]\s+/gm, '• ');   // نقاط القوائم → رمز موحّد
  out = out.replace(/^\s*>\s?/gm, '');          // اقتباسات
  out = out.replace(/\n{3,}/g, '\n\n');         // تقليص الأسطر الفارغة المتتالية
  return out.trim();
}

// أنيميشن «التفكير»: ميزان ذهبي يتأرجح يميناً ويساراً.
function ThinkingScale({ colors }) {
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [tilt]);

  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Image
        source={require('../assets/scale.png')}
        style={{ width: 30, height: 30 }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useLang();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const assistantName = params.name ? String(params.name) : 'ميزان العام';
  // معرّف المساعد المتخصّص (يأتي من شاشة المساعدين). غيابه يعني المنسّق «ميزان العام».
  const assistantId = params.assistantId ? String(params.assistantId) : null;

  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false); // اكتمل تحميل المحادثة المحفوظة؟
  const scrollRef = useRef(null);

  const greeting = { role: 'bot', text: `أنا مساعد «${assistantName}». ${t('chat_greeting')}` };

  // منع تصوير الشاشة داخل المحادثة — للمستخدم العادي فقط. الأدمن مُعفى (للمعاينة والتوثيق).
  useEffect(() => {
    if (isAdmin) {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      return;
    }
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => { ScreenCapture.allowScreenCaptureAsync().catch(() => {}); };
  }, [isAdmin]);

  // تحميل المحادثة المحفوظة محليّاً عند فتح الشاشة، بعد التأكّد من تسجيل الدخول.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const has = !!data?.session;
      setSignedIn(has);
      setChecking(false);
      if (has) {
        // اقرأ صلاحية الأدمن لإعفائه من قيد منع التصوير.
        try {
          const uid = data.session.user.id;
          const { data: prof } = await supabase
            .from('profiles').select('is_admin').eq('id', uid).single();
          if (active && prof?.is_admin === true) setIsAdmin(true);
        } catch (_) { /* تجاهل */ }
        try {
          const saved = await AsyncStorage.getItem(convKey(assistantId));
          if (active && saved) {
            const arr = JSON.parse(saved);
            if (Array.isArray(arr) && arr.length > 0) {
              setMessages(arr);
              setLoaded(true);
              return;
            }
          }
        } catch (_) { /* تجاهل أخطاء القراءة */ }
        if (active) {
          setMessages([greeting]);
          setLoaded(true);
        }
      }
    });
    return () => { active = false; };
  }, [assistantId]);

  // حفظ المحادثة محليّاً كلّما تغيّرت (بعد اكتمال التحميل، لئلّا نطمس المحفوظ).
  useEffect(() => {
    if (!loaded || !signedIn) return;
    AsyncStorage.setItem(convKey(assistantId), JSON.stringify(messages)).catch(() => {});
  }, [messages, loaded, signedIn, assistantId]);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // مسح المحادثة المحفوظة محليّاً والعودة لرسالة الترحيب.
  const clearConversation = async () => {
    try { await AsyncStorage.removeItem(convKey(assistantId)); } catch (_) {}
    setMessages([greeting]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    scrollToEnd();
    setSending(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setSignedIn(false);
        setSending(false);
        return;
      }

      // جسم الطلب: نرسل assistant_id فقط إن كان المستخدم في مساعد متخصّص.
      const payload = assistantId
        ? { message: text, assistant_id: assistantId }
        : { message: text };

      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.access === 'rate_limited') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: data.message || t('chat_rate_limited'),
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      if (data.access === 'subscribe_required') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: t('chat_subscribe_msg'),
          subscribe: true,
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      if (data.mode === 'routed') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: t('chat_routed_msg'),
          route: data.target_name || null,
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      const reply = cleanReply(data.reply) || t('chat_reply_fallback');
      setMessages((m) => [...m, { role: 'bot', text: reply }]);
      scrollToEnd();
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: t('chat_conn_error') }]);
      scrollToEnd();
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.emerald, colors.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.head, { paddingTop: insets.top + 12 }]}
      >
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-forward" size={22} color={colors.goldLight} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.htitle, { writingDirection: writingDir }]}>{assistantName}</Text>
          <Text style={[styles.hsub, { writingDirection: writingDir }]}>{t('chat_subtitle')}</Text>
        </View>
        {signedIn ? (
          <Pressable style={styles.clearBtn} onPress={clearConversation} hitSlop={8}>
            <Ionicons name="trash-outline" size={19} color={colors.goldLight} />
          </Pressable>
        ) : null}
      </LinearGradient>

      {checking ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.emerald} />
        </View>
      ) : !signedIn ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={46} color={colors.muted} />
          <Text style={[styles.gateTitle, { writingDirection: writingDir }]}>{t('chat_gate_title')}</Text>
          <Text style={[styles.gateNote, { writingDirection: writingDir }]}>
            {t('chat_gate_note')}
          </Text>
          <Pressable style={styles.gateBtn} onPress={() => router.replace('/(tabs)/account')}>
            <Text style={styles.gateBtnText}>{t('chat_gate_btn')}</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.discBar}>
              <Text style={[styles.discText, { writingDirection: writingDir }]}>{t('chat_disclaimer')}</Text>
            </View>

            {messages.map((m, i) => (
              <View
                key={i}
                style={[styles.msg, m.role === 'user' ? styles.msgUser : styles.msgBot]}
              >
                <Text
                  style={[
                    m.role === 'user' ? styles.msgUserText : styles.msgBotText,
                    { writingDirection: writingDir },
                  ]}
                >
                  {m.text}
                </Text>
                {m.route ? (
                  <Text style={[styles.routeText, { writingDirection: writingDir }]}>
                    ↪ {t('chat_route_suggest')} {m.route}
                  </Text>
                ) : null}
                {m.subscribe ? (
                  <Pressable style={styles.subBtn} onPress={() => router.push('/(tabs)/subscriptions')}>
                    <Text style={styles.subBtnText}>{t('chat_show_plans')}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {sending ? (
              <View style={[styles.msg, styles.msgBot, styles.thinkingMsg]}>
                <ThinkingScale colors={colors} />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 10 : insets.bottom + 10 }]}>
            <Pressable style={styles.micBtn} onPress={() => {}}>
              <Ionicons name="mic-outline" size={21} color={colors.emerald} />
            </Pressable>
            <TextInput
              style={[styles.input, { writingDirection: writingDir }]}
              placeholder={t('chat_input_placeholder')}
              placeholderTextColor={colors.muted}
              value={input}
              onChangeText={setInput}
              multiline
            />
            <Pressable style={styles.sendBtn} onPress={send} disabled={sending}>
              <Ionicons name="arrow-up" size={22} color={colors.goldLight} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  htitle: { fontFamily: 'Cairo_700Bold', fontSize: 18, color: '#FFFFFF' },
  hsub: { fontFamily: 'Tajawal_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  gateTitle: { fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.textDark, marginTop: 4 },
  gateNote: { fontFamily: 'Tajawal_400Regular', fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  gateBtn: { backgroundColor: colors.emerald, borderRadius: 14, paddingHorizontal: 26, paddingVertical: 14, marginTop: 10 },
  gateBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 15, color: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollBody: { padding: 16 },
  discBar: {
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    borderRadius: 12,
    padding: 11,
    marginBottom: 16,
  },
  discText: { fontFamily: 'Tajawal_400Regular', fontSize: 11.5, color: colors.textBody, lineHeight: 18, textAlign: 'center' },
  msg: { maxWidth: '85%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18, marginBottom: 11 },
  msgUser: { backgroundColor: colors.emerald, alignSelf: 'flex-end', borderBottomLeftRadius: 5 },
  msgBot: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', borderBottomRightRadius: 5 },
  thinkingMsg: { paddingVertical: 14, paddingHorizontal: 18 },
  msgUserText: { fontFamily: 'Tajawal_400Regular', fontSize: 15, color: '#FFFFFF', lineHeight: 26 },
  msgBotText: { fontFamily: 'Tajawal_400Regular', fontSize: 15, color: colors.textDark, lineHeight: 26 },
  routeText: { fontFamily: 'Cairo_700Bold', fontSize: 12.5, color: colors.gold, marginTop: 9, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  subBtn: { backgroundColor: colors.gold, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 16, marginTop: 11, alignSelf: 'flex-start' },
  subBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 13, color: '#3a2e08' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  micBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'Tajawal_400Regular',
    fontSize: 14.5,
    color: colors.textDark,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
