import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Dimensions, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { askAI, logActivity } from "../lib/api";
import { COLORS, RADIUS, THEMES, DEFAULT_THEME } from "../lib/theme";
import { useTheme } from "../lib/ThemeContext";

const { width } = Dimensions.get("window");

export default function SectionScreen({ route, navigation }) {
  // قراءة آمنة للثيم — لو فشل لأي سبب، نستخدم الزمردي
  const themeCtx = useTheme();
  const TH = (themeCtx && themeCtx.theme) ? themeCtx.theme : THEMES[DEFAULT_THEME];

  // قراءة آمنة للقسم — لو لا params، كائن فارغ
  const section = (route && route.params && route.params.section) ? route.params.section : {};
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([
    { id: "welcome", text: "أهلاً بك في " + (section.title || "المستشار") + ". اكتب سؤالك وسأرشدك خطوة بخطوة.", isBot: true },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  useEffect(() => {
    let mounted = true;
    try { logActivity("open_section", section.id || ""); } catch (e) {}
    return () => { mounted = false; };
  }, []);

  const handleSend = async () => {
    const q = inputText.trim();
    if (!q || loading) return;
    const userMsg = { id: Date.now().toString(), text: q, isBot: false };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    try { logActivity("question", section.id || ""); } catch (e) {}
    let ans = "";
    try {
      ans = await askAI(q, section.id || "guidance", []);
    } catch (e) {
      ans = "تعذّر الحصول على رد. تحقّق من الاتصال وحاول مرة أخرى.";
    }
    setLoading(false);
    setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), text: ans || "تعذّر الحصول على رد. حاول مرة أخرى.", isBot: true }]);
  };

  const goBack = () => {
    try { if (navigation && typeof navigation.goBack === "function") navigation.goBack(); } catch (e) {}
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.innerContainer}
      >
        {/* هيدر القسم — بلون الثيم */}
        <View style={[styles.header, { backgroundColor: TH.primary, paddingTop: insets.top + 14 }]}>
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <FontAwesome5 name="arrow-right" size={17} color={TH.accentLite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{section.title || "ميزان"}</Text>
          <View style={styles.headerIcon}>
            <FontAwesome5 name={section.icon || "balance-scale"} size={16} color={TH.accentLite} />
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => { try { scrollViewRef.current && scrollViewRef.current.scrollToEnd({ animated: true }); } catch (e) {} }}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageRow, msg.isBot ? styles.botRow : styles.userRow]}>
              <View style={[styles.avatarBox, { backgroundColor: TH.primary }]}>
                <FontAwesome5 name={msg.isBot ? "user-shield" : "user"} size={11} color={msg.isBot ? TH.accentLite : COLORS.white} />
              </View>
              <View style={[styles.messageBubble, msg.isBot ? styles.botBubble : { backgroundColor: TH.primary, borderBottomLeftRadius: 5 }]}>
                <Text style={[styles.messageText, msg.isBot ? styles.botText : styles.userText]}>{msg.text}</Text>
              </View>
            </View>
          ))}
          {loading && (
            <View style={[styles.messageRow, styles.botRow]}>
              <View style={[styles.avatarBox, { backgroundColor: TH.primary }]}>
                <FontAwesome5 name="user-shield" size={11} color={TH.accentLite} />
              </View>
              <View style={[styles.messageBubble, styles.botBubble, { flexDirection: "row", alignItems: "center" }]}>
                <ActivityIndicator size="small" color={TH.primary} />
                <Text style={[styles.messageText, styles.botText, { marginRight: 8 }]}>يفكّر...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputWrapper}>
          <TouchableOpacity style={[styles.sendButton, { backgroundColor: TH.primary }]} activeOpacity={0.85} onPress={handleSend}>
            <FontAwesome5 name="paper-plane" size={16} color={TH.accentLite} style={styles.sendIconStyle} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder={"اكتب سؤالك هنا..."}
            placeholderTextColor={COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            textAlign="right"
            multiline
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 90 },
  innerContainer: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 16,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  headerTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: 18, color: COLORS.white, flex: 1, textAlign: "center", marginHorizontal: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  chatContent: { padding: 18, paddingTop: 16, paddingBottom: 24 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 18, width: "100%" },
  botRow: { justifyContent: "flex-end" },
  userRow: { justifyContent: "flex-start" },
  avatarBox: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", marginHorizontal: 8, marginBottom: 2 },
  messageBubble: {
    maxWidth: width * 0.74, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3,
  },
  botBubble: { backgroundColor: COLORS.surface, borderBottomRightRadius: 5, borderWidth: 1, borderColor: COLORS.border },
  messageText: { fontFamily: "Tajawal_500Medium", fontSize: 14.5, lineHeight: 23, textAlign: "right" },
  botText: { color: COLORS.textBody },
  userText: { color: COLORS.white },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8,
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: COLORS.bgPure, borderRadius: 30, borderWidth: 1, borderColor: COLORS.glassBorder,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 8,
  },
  textInput: { flex: 1, fontFamily: "Tajawal_500Medium", fontSize: 14.5, color: COLORS.onyx, paddingHorizontal: 14, maxHeight: 100, minHeight: 44 },
  sendButton: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  sendIconStyle: { marginRight: 2, transform: [{ scaleX: -1 }] },
});
