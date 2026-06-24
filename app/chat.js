import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';

const FN_URL = 'https://lzfgjvafmvofwjiyvelq.supabase.co/functions/v1/rapid-function';
const DISCLAIMER = 'ميزان مساعد استرشادي للتوعية، والمعلومات قد تتغيّر، ويُنصح بالتحقّق من مختصّ قبل الإجراء.';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const assistantName = params.name ? String(params.name) : 'ميزان العام';
  // معرّف المساعد المتخصّص (يأتي من شاشة المساعدين). غيابه يعني المنسّق «ميزان العام».
  const assistantId = params.assistantId ? String(params.assistantId) : null;

  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // فحص جلسة المستخدم
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const has = !!data?.session;
      setSignedIn(has);
      setChecking(false);
      if (has) {
        setMessages([{ role: 'bot', text: `أنا مساعد «${assistantName}». اطرح سؤالك، كيف أخدمك اليوم؟` }]);
      }
    });
    return () => { active = false; };
  }, [assistantName]);

  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
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
      // غيابه → المنسّق «ميزان العام» (كما هو السلوك الافتراضي في الخادم).
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

      // حدّ المعدّل: طلبات كثيرة بسرعة
      if (data.access === 'rate_limited') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: data.message || 'أرسلت الطلبات بسرعة كبيرة. انتظر لحظةً ثم حاول مرة أخرى.',
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      // طلب الاشتراك
      if (data.access === 'subscribe_required') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: 'لقد استفدت من رسائلك المجانية. للاستمرار والوصول إلى المختصّين، يمكنك الاشتراك.',
          subscribe: true,
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      // توجيه لمساعد متخصّص (يحدث من المنسّق فقط)
      if (data.mode === 'routed') {
        setMessages((m) => [...m, {
          role: 'bot',
          text: 'سؤالك يخصّ مجالاً متخصّصاً، وأنصح بالتحدّث مع المختصّ المناسب.',
          route: data.target_name || null,
        }]);
        scrollToEnd();
        setSending(false);
        return;
      }

      // ردّ المساعد (متخصّص أو عام)
      const reply = data.reply || 'تعذّر الحصول على ردّ الآن. حاول مرة أخرى.';
      setMessages((m) => [...m, { role: 'bot', text: reply }]);
      scrollToEnd();
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: 'حدث خطأ في الاتصال. تحقّق من الإنترنت وحاول مجدداً.' }]);
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
          <Text style={[styles.hsub, { writingDirection: writingDir }]}>مساعد استرشادي</Text>
        </View>
      </LinearGradient>

      {checking ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.emerald} />
        </View>
      ) : !signedIn ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={46} color={colors.muted} />
          <Text style={[styles.gateTitle, { writingDirection: writingDir }]}>يلزم تسجيل الدخول</Text>
          <Text style={[styles.gateNote, { writingDirection: writingDir }]}>
            لبدء المحادثة مع مساعدي ميزان، سجّل دخولك أولاً.
          </Text>
          <Pressable style={styles.gateBtn} onPress={() => router.replace('/(tabs)/account')}>
            <Text style={styles.gateBtnText}>الذهاب لتسجيل الدخول</Text>
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
          >
            <View style={styles.discBar}>
              <Text style={[styles.discText, { writingDirection: writingDir }]}>{DISCLAIMER}</Text>
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
                    ↪ المختصّ المقترح: {m.route}
                  </Text>
                ) : null}
                {m.subscribe ? (
                  <Pressable style={styles.subBtn} onPress={() => router.push('/(tabs)/subscriptions')}>
                    <Text style={styles.subBtnText}>عرض الباقات</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {sending ? (
              <View style={[styles.msg, styles.msgBot]}>
                <ActivityIndicator size="small" color={colors.emerald} />
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
            <Pressable style={styles.micBtn} onPress={() => {}}>
              <Ionicons name="mic-outline" size={21} color={colors.emerald} />
            </Pressable>
            <TextInput
              style={[styles.input, { writingDirection: writingDir }]}
              placeholder="اكتب سؤالك..."
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

const styles = StyleSheet.create({
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
  msg: { maxWidth: '82%', padding: 12, borderRadius: 18, marginBottom: 12 },
  msgUser: { backgroundColor: colors.emerald, alignSelf: 'flex-end', borderBottomLeftRadius: 5 },
  msgBot: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start', borderBottomRightRadius: 5 },
  msgUserText: { fontFamily: 'Tajawal_400Regular', fontSize: 14.5, color: '#FFFFFF', lineHeight: 24 },
  msgBotText: { fontFamily: 'Tajawal_400Regular', fontSize: 14.5, color: colors.textDark, lineHeight: 24 },
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
