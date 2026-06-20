import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator, Alert, Keyboard,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { streamAI, logActivity, loadChat, saveChat, clearChat, toHistory, parseTags } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speech";
import { startListening, stopListening, destroyVoice, isVoiceAvailable } from "../lib/voiceInput";
import { captureFromCamera, pickFromGallery } from "../lib/imageCapture";
import { checkCanChat, recordUsage } from "../lib/usageLimits";
import { recordQuestionStat } from "../lib/localStats";
import { QUICK_EXAMPLES, RADIUS } from "../lib/theme";
import { useTheme, scaled } from "../lib/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../lib/i18n";

const { width } = Dimensions.get("window");

// ألوان شارة الثقة بحسب الدرجة. المفتاح العربي يطابق وسم المساعد، والتسمية تُترجم.
const CONF_STYLE = {
  "مؤكد": { bg: "#DCFCE7", fg: "#166534", icon: "check-circle", labelKey: "confident_badge" },
  "استرشادي": { bg: "#FEF9C3", fg: "#854D0E", icon: "info-circle", labelKey: "verify_source" },
  "تحقق": { bg: "#FEE2E2", fg: "#991B1B", icon: "exclamation-circle", labelKey: "verify_source" },
};

export default function SectionScreen({ route, navigation }) {
  const { colors, fontScale, lang , dir } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, fontScale, dir, insets);
  const { section } = route.params || {};
  const sectionId = section?.id || "guidance";
  // عنوان القسم المترجم: من مفتاح title_<id> إن وُجد، وإلا الاسم الأصلي
  const sectionTitle = section ? t("title_" + sectionId, lang) : t("title_guidance", lang);
  const welcomeMsg = {
    id: "welcome",
    text: t("chat_welcome_section", lang, { name: sectionTitle }),
    isBot: true,
  };

  const [messages, setMessages] = useState([welcomeMsg]);
  const [inputText, setInputText] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [listening, setListening] = useState(false);
  const scrollViewRef = useRef();
  const stopRef = useRef(null);
  const streamingIdRef = useRef(null);

  useEffect(() => {
    return () => { stopSpeaking(); destroyVoice(); };
  }, []);

  // مستمع لوحة المفاتيح: عند الفتح يلتصق المربع فوق الكيبورد، وعند الإغلاق يعود فوق القائمة السفلية
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const toggleListening = async () => {
    if (listening) {
      await stopListening();
      setListening(false);
      return;
    }
    if (!isVoiceAvailable()) {
      Alert.alert(t("voice_input", lang), t("voice_note", lang));
      return;
    }
    setListening(true);
    await startListening({
      onResult: (text) => { setInputText(text); },
      onError: (msg) => { setListening(false); Alert.alert(t("voice_input", lang), msg); },
      onEnd: () => { setListening(false); },
    });
  };

  const toggleSpeak = (id, text) => {
    if (speakingId === id) {
      stopSpeaking();
      setSpeakingId(null);
    } else {
      setSpeakingId(id);
      speak(text, { onDone: () => setSpeakingId(null) });
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      logActivity("open_section", sectionId);
      const saved = await loadChat(sectionId);
      if (mounted && saved && saved.length) {
        setMessages([welcomeMsg, ...saved]);
      }
      if (mounted) {
        setHydrated(true);
        // بذرة سؤال قادمة من الأسئلة الشائعة: تُرسل تلقائياً بعد جهوزية الشاشة
        const seed = route.params?.seed;
        if (seed && typeof seed === "string") {
          setTimeout(() => { if (mounted) handleSend(seed); }, 350);
        }
      }
    })();
    return () => {
      mounted = false;
      if (stopRef.current) stopRef.current();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || streaming) return;
    const toPersist = messages.filter((m) => m.id !== "welcome");
    saveChat(sectionId, toPersist);
  }, [messages, hydrated, streaming]);

  const handleSend = async (presetText) => {
    const q = (typeof presetText === "string" ? presetText : inputText).trim();
    if (!q || loading || streaming) return;

    // فرض حصة الباقة: عند نفاد الحصة تظهر رسالة في الشات (نصها يختلف حسب الباقة)
    const limit = await checkCanChat();
    if (!limit.allowed) {
      const msgId = (Date.now() + 2).toString();
      setMessages((prev) => [...prev, { id: msgId, text: limit.expireMsg, isBot: true, isQuotaNotice: true }]);
      return;
    }
    recordUsage();
    recordQuestionStat();

    const history = toHistory(messages);
    const userMsg = { id: Date.now().toString(), text: q, isBot: false };
    const botId = (Date.now() + 1).toString();
    streamingIdRef.current = botId;

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    logActivity("question", sectionId);
    setMessages((prev) => [...prev, { id: botId, text: "", isBot: true }]);

    stopRef.current = streamAI(q, sectionId, history, {
      lang,
      onDelta: (_piece, fullSoFar) => {
        setLoading(false);
        setStreaming(true);
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: fullSoFar } : m)));
      },
      onDone: () => { setLoading(false); setStreaming(false); stopRef.current = null; },
      onError: (msg) => {
        setLoading(false); setStreaming(false); stopRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: msg || "تعذّر الحصول على رد. حاول مرة أخرى." } : m)));
      },
    });
  };

  const stopStreaming = () => {
    if (stopRef.current) { stopRef.current(); stopRef.current = null; }
    setStreaming(false); setLoading(false);
  };

  // إرسال صورة مستند للتحليل البصري اللحظي (لا تُخزّن في أي مكان)
  const sendImage = (dataUrl) => {
    if (loading || streaming) return;
    const history = toHistory(messages);
    const promptText = inputText.trim();
    const userMsg = { id: Date.now().toString(), text: promptText ? promptText + "\n(أُرفقت صورة مستند للتحليل)" : "صورة مستند للتحليل", isBot: false };
    const botId = (Date.now() + 1).toString();
    streamingIdRef.current = botId;

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    logActivity("question", sectionId);
    setMessages((prev) => [...prev, { id: botId, text: "", isBot: true }]);

    stopRef.current = streamAI(promptText, sectionId, history, {
      image: dataUrl,
      lang,
      onDelta: (_piece, fullSoFar) => {
        setLoading(false); setStreaming(true);
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: fullSoFar } : m)));
      },
      onDone: () => { setLoading(false); setStreaming(false); stopRef.current = null; },
      onError: (msg) => {
        setLoading(false); setStreaming(false); stopRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === botId ? { ...m, text: msg || "تعذّر تحليل الصورة. حاول مرة أخرى." } : m)));
      },
    });
  };

  const attachDocument = () => {
    if (loading || streaming) return;
    Alert.alert(
      t("attach_doc", lang),
      lang==="en"?"Photograph the document or pick an image from your gallery to analyze. The image is not stored anywhere.":"صوّر المستند أو اختر صورة من معرضك لتحليله. لا تُحفظ الصورة في أي مكان.",
      [
        { text: t("camera", lang), onPress: async () => {
          const r = await captureFromCamera();
          if (r.ok) sendImage(r.dataUrl);
          else if (!r.canceled && r.error) Alert.alert(t("alert_failed", lang), r.error);
        } },
        { text: t("gallery", lang), onPress: async () => {
          const r = await pickFromGallery();
          if (r.ok) sendImage(r.dataUrl);
          else if (!r.canceled && r.error) Alert.alert(t("alert_failed", lang), r.error);
        } },
        { text: t("cancel", lang), style: "cancel" },
      ]
    );
  };

  const confirmClear = () => {
    if (streaming || loading) return;
    Alert.alert(
      t("clear_chat", lang),
      lang==="en"?"This chat will be permanently deleted from this device. Continue?":"سيتم حذف هذه المحادثة من هذا الجهاز نهائياً. هل تريد المتابعة؟",
      [
        { text: t("cancel", lang), style: "cancel" },
        { text: t("sig_clear", lang), style: "destructive", onPress: async () => { await clearChat(sectionId); setMessages([welcomeMsg]); } },
      ]
    );
  };

  const examples = QUICK_EXAMPLES[sectionId] || [];
  const showExamples = hydrated && examples.length > 0 && messages.filter((m) => m.id !== "welcome").length === 0;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
        style={styles.innerContainer}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome5 name="arrow-right" size={17} color={colors.platinum} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{sectionTitle}</Text>
          <TouchableOpacity onPress={confirmClear} style={styles.headerIcon} activeOpacity={0.8}>
            <FontAwesome5 name="trash-alt" size={15} color={colors.platinum} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => {
            const isStreamingThis = streaming && msg.id === streamingIdRef.current;
            const isWelcome = msg.id === "welcome";
            const parsed = msg.isBot && !isWelcome ? parseTags(msg.text) : null;
            const displayText = parsed ? parsed.clean : msg.text;
            const conf = parsed && parsed.confidence ? CONF_STYLE[parsed.confidence] : null;
            const canExport = msg.isBot && !isWelcome && displayText && displayText.length > 120 && !isStreamingThis;

            // الرسالة الترحيبية: مربع فاخر مميّز يناسب هوية التطبيق
            if (isWelcome) {
              return (
                <View key={msg.id} style={styles.welcomeCard}>
                  <View style={styles.welcomeIconWrap}>
                    <FontAwesome5 name="balance-scale" size={20} color={colors.platinum} />
                  </View>
                  <Text style={styles.welcomeText}>{displayText}</Text>
                </View>
              );
            }

            return (
              <View key={msg.id} style={[styles.messageRow, msg.isBot ? styles.botRow : styles.userRow]}>
                <View style={[styles.avatarBox, msg.isBot ? styles.botAvatar : styles.userAvatar]}>
                  <FontAwesome5 name={msg.isBot ? "user-shield" : "user"} size={11} color={msg.isBot ? colors.platinum : colors.white} />
                </View>
                <View style={styles.bubbleColumn}>
                  {conf && !isStreamingThis && (
                    <View style={[styles.confBadge, { backgroundColor: conf.bg }]}>
                      <FontAwesome5 name={conf.icon} size={10} color={conf.fg} />
                      <Text style={[styles.confText, { color: conf.fg }]}>{t(conf.labelKey, lang)}</Text>
                    </View>
                  )}
                  {parsed && parsed.deadline && !isStreamingThis && (
                    <View style={styles.deadlineAlert}>
                      <FontAwesome5 name="clock" size={12} color={colors.white} />
                      <Text style={styles.deadlineText}>{parsed.deadline}</Text>
                    </View>
                  )}
                  <View style={[styles.messageBubble, msg.isBot ? styles.botBubble : styles.userBubble, msg.isQuotaNotice ? styles.quotaBubble : null]}>
                    {msg.isBot && msg.text === "" ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <ActivityIndicator size="small" color={colors.platinum} />
                        <Text style={[styles.messageText, styles.botText, { marginRight: 8 }]}>{t("thinking", lang)}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.messageText, msg.isBot ? styles.botText : styles.userText, msg.isQuotaNotice ? styles.quotaText : null]}>{displayText}</Text>
                    )}
                  </View>
                  {canExport && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.exportBtn} activeOpacity={0.8} onPress={() => toggleSpeak(msg.id, displayText)}>
                        <FontAwesome5 name={speakingId === msg.id ? "stop" : "volume-up"} size={11} color={colors.royal} />
                        <Text style={styles.exportBtnText}>{speakingId === msg.id ? (lang==="en"?"Stop":"إيقاف") : t("listen", lang)}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {showExamples && (
            <View style={styles.examplesWrap}>
              <Text style={styles.examplesLabel}>{t("examples_start", lang)}</Text>
              {examples.map((ex, i) => (
                <TouchableOpacity key={i} style={styles.exampleChip} activeOpacity={0.85} onPress={() => handleSend(ex)}>
                  <Text style={styles.exampleText}>{ex}</Text>
                  <FontAwesome5 name="arrow-left" size={10} color={colors.royal} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputWrapper, keyboardOpen && { marginBottom: 10 }]}>
          {streaming ? (
            <TouchableOpacity style={styles.stopButton} activeOpacity={0.85} onPress={stopStreaming}>
              <FontAwesome5 name="stop" size={14} color={colors.white} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton} activeOpacity={0.85} onPress={() => handleSend()}>
              <FontAwesome5 name="paper-plane" size={20} color={colors.royal} style={styles.sendIconStyle} />
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.textInput}
            placeholder={t("ask_placeholder", lang)}
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            textAlign={dir.textAlign}
            multiline
            editable={!streaming}
          />
          <TouchableOpacity style={[styles.micButton, listening && styles.micButtonActive]} activeOpacity={0.85} onPress={toggleListening}>
            <FontAwesome5 name="microphone" size={15} color={listening ? colors.white : colors.royal} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachButton} activeOpacity={0.85} onPress={attachDocument}>
            <FontAwesome5 name="camera" size={15} color={colors.royal} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors, fontScale, dir, insets = { bottom: 0 }) {
  const TAB_BAR_HEIGHT = 64 + insets.bottom; // ارتفاع الشريط السفلي الفعلي (ديناميكي)
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    innerContainer: { flex: 1 },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingTop: Platform.OS === "ios" ? 54 : 24, paddingHorizontal: 18, paddingBottom: 16,
      backgroundColor: colors.royal, borderBottomWidth: 1, borderColor: colors.glassBorder,
    },
    backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder },
    headerTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(18, fontScale), color: colors.white },
    headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(212,175,55,0.12)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder },
    chatContent: { padding: 18, paddingTop: 16, paddingBottom: 24 },
    messageRow: { flexDirection: "row", alignItems: dir.alignEnd, marginBottom: 18, width: "100%" },
    botRow: { justifyContent: dir.rowStart },
    userRow: { justifyContent: "flex-start" },
    avatarBox: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", marginHorizontal: 8, marginBottom: 2 },
    botAvatar: { backgroundColor: colors.royal },
    userAvatar: { backgroundColor: colors.royal },
    messageBubble: {
      maxWidth: width * 0.74, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 12,
      shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3,
    },
    bubbleColumn: { maxWidth: width * 0.74, alignItems: dir.colStart },
    quotaBubble: { backgroundColor: colors.royalSoft, borderWidth: 1, borderColor: colors.platinum },
    quotaText: { color: colors.royal, fontFamily: "Tajawal_700Bold" },
    confBadge: { flexDirection: dir.row, alignItems: "center", alignSelf: "flex-end", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6 },
    confText: { fontFamily: "Tajawal_700Bold", fontSize: scaled(10.5, fontScale), marginRight: 6 },
    deadlineAlert: {
      flexDirection: dir.row, alignItems: "center", alignSelf: "stretch",
      backgroundColor: colors.danger, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
      shadowColor: colors.danger, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
    },
    deadlineText: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(12.5, fontScale), color: colors.white, marginRight: 8, flex: 1, textAlign: dir.textAlign, lineHeight: scaled(20, fontScale) },
    botBubble: { backgroundColor: colors.surface, borderBottomRightRadius: 5, borderWidth: 1, borderColor: colors.border },
    welcomeCard: {
      flexDirection: dir.row, alignItems: "center",
      backgroundColor: colors.royalSoft,
      borderRadius: 20, borderWidth: 1.5, borderColor: colors.platinum,
      paddingVertical: 16, paddingHorizontal: 16, marginBottom: 20,
      shadowColor: colors.platinum, shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18, shadowRadius: 12, elevation: 5,
    },
    welcomeIconWrap: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: colors.royal, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: colors.platinum,
      marginLeft: dir.isRTL ? 14 : 0, marginRight: dir.isRTL ? 0 : 14,
    },
    welcomeText: {
      flex: 1, fontFamily: "Tajawal_700Bold",
      fontSize: scaled(14, fontScale), color: colors.onyx,
      lineHeight: scaled(23, fontScale), textAlign: dir.textAlign,
    },
    userBubble: { backgroundColor: colors.royal, borderBottomLeftRadius: 5 },
    messageText: { fontFamily: "Tajawal_500Medium", fontSize: scaled(14.5, fontScale), lineHeight: scaled(23, fontScale), textAlign: dir.textAlign },
    botText: { color: colors.textBody },
    userText: { color: colors.white },
    examplesWrap: { marginTop: 6, alignItems: dir.colStart },
    examplesLabel: { fontFamily: "Tajawal_700Bold", fontSize: scaled(12, fontScale), color: colors.textDim, marginBottom: 10, textAlign: dir.textAlign, width: "100%" },
    exampleChip: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      backgroundColor: colors.surface, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12,
      marginBottom: 10, width: "100%", borderWidth: 1, borderColor: colors.glassBorder,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    exampleText: { fontFamily: "Tajawal_500Medium", fontSize: scaled(13, fontScale), color: colors.textBody, textAlign: dir.textAlign, flex: 1, marginLeft: 10 },
    inputWrapper: {
      flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8,
      marginHorizontal: 16, marginBottom: TAB_BAR_HEIGHT + 10,
      backgroundColor: colors.bgPure, borderRadius: 30, borderWidth: 1, borderColor: colors.glassBorder,
      shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 8,
    },
    textInput: { flex: 1, fontFamily: "Tajawal_500Medium", fontSize: scaled(14.5, fontScale), color: colors.onyx, paddingHorizontal: 14, maxHeight: 100, minHeight: 44 },
    sendButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.platinum, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.glassBorder, shadowColor: colors.platinum, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 6 },
    stopButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    exportBtn: { flexDirection: dir.row, alignItems: "center", marginTop: 8, marginRight: 2, backgroundColor: colors.royalSoft, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.glassBorder },
    actionRow: { flexDirection: dir.row, alignItems: "center", gap: 8 },
    exportBtnText: { fontFamily: "Tajawal_700Bold", fontSize: scaled(11.5, fontScale), color: colors.royal, marginRight: 7 },
    sendIconStyle: { marginRight: 2, transform: [{ scaleX: -1 }] },
    micButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.royalSoft, alignItems: "center", justifyContent: "center", marginLeft: 6, borderWidth: 1, borderColor: colors.glassBorder },
    micButtonActive: { backgroundColor: colors.danger, borderColor: colors.danger },
    attachButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.royalSoft, alignItems: "center", justifyContent: "center", marginLeft: 6, borderWidth: 1, borderColor: colors.glassBorder },
  });
}
