import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { useTheme } from "../lib/ThemeContext";

export default function AuthScreen({ navigation }) {
  const { theme: TH } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  const enterApp = useCallback(() => {
    try {
      if (navigation && typeof navigation.replace === "function") {
        navigation.replace("MainTabs");
      } else if (navigation && typeof navigation.navigate === "function") {
        navigation.navigate("MainTabs");
      } else {
        setMessage("تعذّر الانتقال: زر التنقّل غير متاح.");
      }
    } catch (e) {
      setMessage("خطأ في الانتقال: " + String(e.message || e));
    }
  }, [navigation]);

  const runBiometric = useCallback(async () => {
    setStatus("checking");
    setMessage("");
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        enterApp();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "أكّد هويتك للدخول إلى ميزان",
        cancelLabel: "إلغاء",
        disableDeviceFallback: false,
      });
      if (result.success) {
        enterApp();
      } else {
        setStatus("failed");
        setMessage("لم يتم التحقّق. استخدم الزر للدخول.");
      }
    } catch (e) {
      setStatus("failed");
      setMessage("تعذّر التحقّق. استخدم الزر للدخول.");
    }
  }, [enterApp]);

  useEffect(() => {
    let mounted = true;
    (async () => { if (mounted) await runBiometric(); })();
    return () => { mounted = false; };
  }, [runBiometric]);

  return (
    <View style={[styles.container, { backgroundColor: TH.primaryDeep, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={[styles.iconCircle, { borderColor: TH.accentLite }]}>
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
          <TouchableOpacity style={[styles.unlockButton, { backgroundColor: TH.accent }]} activeOpacity={0.85} onPress={runBiometric}>
            <FontAwesome5 name="fingerprint" size={20} color={TH.primaryDeep} style={{ marginLeft: 10 }} />
            <Text style={[styles.unlockText, { color: TH.primaryDeep }]}>فتح بالبصمة</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.enterDirect} activeOpacity={0.7} onPress={enterApp}>
          <Text style={styles.enterDirectText}>الدخول للتطبيق</Text>
        </TouchableOpacity>
        {message ? <Text style={styles.errorMessage}>{message}</Text> : null}
      </View>
      <Text style={styles.footer}>إرشاد توعوي بالأنظمة والإجراءات السعودية</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  iconCircle: { width: 96, height: 96, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: 22, backgroundColor: "rgba(255,255,255,0.12)" },
  appTitle: { fontFamily: "Cairo_900Black", fontSize: 30, color: "#fff", letterSpacing: 0.5 },
  appSub: { fontFamily: "Tajawal_500Medium", fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 8, textAlign: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 36 },
  statusText: { fontFamily: "Tajawal_700Bold", fontSize: 14, color: "rgba(255,255,255,0.85)", marginRight: 10 },
  unlockButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, paddingHorizontal: 36, borderRadius: 16, marginTop: 36 },
  unlockText: { fontFamily: "Cairo_800ExtraBold", fontSize: 15.5 },
  enterDirect: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 24 },
  enterDirectText: { fontFamily: "Tajawal_700Bold", fontSize: 14, color: "rgba(255,255,255,0.6)", textDecorationLine: "underline" },
  errorMessage: { fontFamily: "Tajawal_500Medium", fontSize: 12.5, color: "#FCA5A5", marginTop: 18, textAlign: "center", paddingHorizontal: 20 },
  footer: { fontFamily: "Tajawal_400Regular", fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", paddingBottom: 28 },
});
