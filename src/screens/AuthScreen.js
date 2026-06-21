import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { COLORS, THEMES, DEFAULT_THEME } from "../lib/theme";
import { useTheme } from "../lib/ThemeContext";

const { width } = Dimensions.get("window");

// شاشة قفل البصمة — تظهر عند كل فتح للتطبيق (قفل أمني دائم)
export default function AuthScreen({ navigation }) {
  const themeCtx = useTheme();
  const TH = (themeCtx && themeCtx.theme) ? themeCtx.theme : THEMES[DEFAULT_THEME];
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState("idle"); // idle | checking | failed
  const [message, setMessage] = useState("");

  const enterApp = useCallback(() => {
    try {
      if (navigation && typeof navigation.replace === "function") {
        navigation.replace("MainTabs"); // replace يمنع العودة لشاشة القفل
      }
    } catch (e) {}
  }, [navigation]);

  const runBiometric = useCallback(async () => {
    setStatus("checking");
    setMessage("");
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // لا عتاد بصمة أو لا بصمات مسجّلة → دخول مباشر (لا نحبس المستخدم)
      if (!hasHardware || !isEnrolled) {
        enterApp();
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "أكّد هويتك للدخول إلى ميزان",
        fallbackLabel: "استخدم رمز الجهاز",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });

      if (result && result.success) {
        enterApp();
      } else {
        setStatus("failed");
        setMessage("تعذّر التحقّق. حاول مرة أخرى.");
      }
    } catch (e) {
      // أي خطأ في البصمة لا يكسر التطبيق — يعرض زر إعادة المحاولة
      setStatus("failed");
      setMessage("حدث خطأ أثناء التحقّق. حاول مرة أخرى.");
    }
  }, [enterApp]);

  // محاولة البصمة تلقائياً عند فتح الشاشة + تنظيف
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (mounted) await runBiometric();
    })();
    return () => { mounted = false; };
  }, [runBiometric]);

  return (
    <View style={[styles.container, { backgroundColor: TH.primaryDeep, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: TH.accentLite }]}>
          <FontAwesome5 name="balance-scale" size={44} color={TH.accentLite} />
        </View>
        <Text style={styles.appTitle}>مِيزان</Text>
        <Text style={styles.appSub}>القفل الآمن — أكّد هويتك للمتابعة</Text>

        {status === "checking" ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={TH.accentLite} />
            <Text style={styles.statusText}>جارٍ التحقّق...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.unlockButton, { backgroundColor: TH.accent }]}
            activeOpacity={0.85}
            onPress={runBiometric}
          >
            <FontAwesome5 name="fingerprint" size={20} color={TH.primaryDeep} style={{ marginLeft: 10 }} />
            <Text style={[styles.unlockText, { color: TH.primaryDeep }]}>
              {status === "failed" ? "إعادة المحاولة" : "فتح بالبصمة"}
            </Text>
          </TouchableOpacity>
        )}

        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
      </View>

      <Text style={styles.footer}>إرشاد توعوي بالأنظمة والإجراءات السعودية</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconCircle: {
    width: 96, height: 96, borderRadius: 30, alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 22,
  },
  appTitle: { fontFamily: "Cairo_900Black", fontSize: 30, color: "#fff", letterSpacing: 0.5 },
  appSub: { fontFamily: "Tajawal_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 8, textAlign: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 36 },
  statusText: { fontFamily: "Tajawal_700Bold", fontSize: 14, color: "rgba(255,255,255,0.85)", marginRight: 10 },
  unlockButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 15, paddingHorizontal: 36, borderRadius: 16, marginTop: 36,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5,
  },
  unlockText: { fontFamily: "Cairo_800ExtraBold", fontSize: 15.5 },
  errorMessage: { fontFamily: "Tajawal_500Medium", fontSize: 12.5, color: "#FCA5A5", marginTop: 18, textAlign: "center" },
  footer: { fontFamily: "Tajawal_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", paddingBottom: 28 },
});
