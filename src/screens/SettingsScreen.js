import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView, Modal, TextInput, ActivityIndicator } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { RADIUS } from "../lib/theme";
import { useTheme, scaled } from "../lib/ThemeContext";
import { isBiometricAvailable, isLockEnabled, setLockEnabled } from "../lib/biometric";
import { t } from "../lib/i18n";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FONT_OPTIONS = [
  { id: "font_small", value: 0.9 },
  { id: "font_normal", value: 1.0 },
  { id: "font_large", value: 1.25 },
  { id: "font_largest", value: 1.5 },
];

export default function SettingsScreen({ navigation }) {
  const { colors, isDark, fontScale, lang, toggleTheme, setFontScale, dir } = useTheme();
  const [email, setEmail] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  // نوافذ تعديل الملف وإدارة الاشتراك
  const [editVisible, setEditVisible] = useState(false);
  const [subVisible, setSubVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPass, setEditPass] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [planId, setPlanId] = useState("free");
  const [planExpiry, setPlanExpiry] = useState("");
  // نافذة سياسة الخصوصية + رصد التمرير للقاع
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [privacyScrolledEnd, setPrivacyScrolledEnd] = useState(false);
  const styles = makeStyles(colors, fontScale, dir);

  // ===== منطق التمرير الصارم لسياسة الخصوصية (نفس معايير شاشة الموافقة) =====
  // refs لتفادي حساسية أندرويد الناتجة عن القيم العشرية واختلاف كثافة البكسل
  const pContentH = React.useRef(0);
  const pLayoutH = React.useRef(0);
  const pScrollY = React.useRef(0);
  const PRIVACY_TOLERANCE = 50;

  const evalPrivacyBottom = () => {
    const c = pContentH.current, l = pLayoutH.current, y = pScrollY.current;
    if (c <= 0 || l <= 0) return;
    if (c - (l + y) < PRIVACY_TOLERANCE) setPrivacyScrolledEnd(true);
  };
  const onPrivacyScroll = (e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    pLayoutH.current = layoutMeasurement.height;
    pContentH.current = contentSize.height;
    pScrollY.current = contentOffset.y;
    evalPrivacyBottom();
  };
  const openPrivacy = () => {
    setPrivacyScrolledEnd(false); // يُعاد الضبط في كل فتح
    pContentH.current = 0; pLayoutH.current = 0; pScrollY.current = 0;
    setPrivacyVisible(true);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email) { setEmail(user.email); setEditEmail(user.email); }
        const meta = user.user_metadata || {};
        if (meta.full_name) setEditName(meta.full_name);
        if (meta.plan_id) setPlanId(meta.plan_id);
        if (meta.plan_expiry) setPlanExpiry(meta.plan_expiry);
      }
      setBioAvailable(await isBiometricAvailable());
      setBioEnabled(await isLockEnabled());
    })();
  }, []);

  // حفظ تعديلات الملف الشخصي عبر Supabase
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates = { data: { full_name: editName } };
      if (editEmail && editEmail !== email) updates.email = editEmail;
      if (editPass && editPass.length >= 6) updates.password = editPass;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) {
        Alert.alert(t("update_fail", lang), error.message || "");
      } else {
        if (editEmail && editEmail !== email) setEmail(editEmail);
        setEditPass("");
        setEditVisible(false);
        Alert.alert(t("alert_done", lang), t("update_done", lang));
      }
    } catch (e) {
      Alert.alert(t("update_fail", lang), String(e?.message || e));
    } finally {
      setSavingProfile(false);
    }
  };

  const onToggleBio = async (val) => {
    const res = await setLockEnabled(val);
    if (res.ok) {
      setBioEnabled(val);
    } else {
      Alert.alert(t("biometric_lock", lang), res.error || t("biometric_fail", lang));
    }
  };

  const deleteAllData = () => {
    Alert.alert(
      t("delete_confirm_title", lang),
      t("delete_confirm_msg", lang),
      [
        { text: t("cancel", lang), style: "cancel" },
        {
          text: t("delete_all_btn", lang),
          style: "destructive",
          onPress: async () => {
            try {
              const keys = await AsyncStorage.getAllKeys();
              const mine = (keys || []).filter((k) => k && k.indexOf("mizan_") === 0);
              await AsyncStorage.multiRemove(mine);
              Alert.alert(t("alert_done", lang), t("delete_done", lang));
            } catch (_e) {
              Alert.alert(t("alert_failed", lang), t("delete_fail", lang));
            }
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert(t("alert_error", lang), t("logout_err", lang));
    } else {
      setEmail("");
      Alert.alert(t("alert_done", lang), t("logout_done", lang));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerTitle}>{t("settings", lang)}</Text>

      {/* بطاقة الملف التعريفي */}
      <View style={styles.profileCard}>
        <View style={styles.avatarBox}>
          <FontAwesome5 name="user-circle" size={34} color={colors.white} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileLabel}>{t("account", lang)}</Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {email ? email : t("guest", lang)}
          </Text>
        </View>
      </View>

      {/* قسم المظهر: الوضع المظلم وحجم الخط */}
      <Text style={styles.sectionLabel}>{t("appearance", lang)}</Text>
      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.platinum }}
            thumbColor={colors.white}
          />
          <View style={styles.menuLabelWrap}>
            <Text style={styles.menuText}>{t("dark_mode", lang)}</Text>
            <FontAwesome5 name={isDark ? "moon" : "sun"} size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.fontBlock}>
          <View style={styles.menuLabelWrap}>
            <View style={{ flex: 1 }} />
            <Text style={styles.menuText}>{t("font_size", lang)}</Text>
            <FontAwesome5 name="text-height" size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
          <View style={styles.fontOptionsRow}>
            {FONT_OPTIONS.map((opt) => {
              const active = Math.abs(fontScale - opt.value) < 0.01;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.fontChip, active && styles.fontChipActive]}
                  activeOpacity={0.85}
                  onPress={() => setFontScale(opt.value)}
                >
                  <Text style={[styles.fontChipText, active && styles.fontChipTextActive]}>{t(opt.id, lang)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.divider} />

        <View style={styles.menuItem}>
          <Switch
            value={bioEnabled}
            onValueChange={onToggleBio}
            disabled={!bioAvailable}
            trackColor={{ false: colors.border, true: colors.platinum }}
            thumbColor={colors.white}
          />
          <View style={styles.menuLabelWrap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuText}>{t("biometric_lock", lang)}</Text>
              {!bioAvailable && <Text style={styles.menuSubText}>{lang==="en"?"Not available on this device":"غير متاح على هذا الجهاز"}</Text>}
            </View>
            <FontAwesome5 name="fingerprint" size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
        </View>
      </View>

      {/* قسم إدارة البيانات */}
      <Text style={styles.sectionLabel}>{t("my_data", lang)}</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={deleteAllData}>
          <View style={{ width: 13 }} />
          <View style={styles.menuLabelWrap}>
            <Text style={[styles.menuText, { color: colors.danger }]}>{t("delete_all", lang)}</Text>
            <FontAwesome5 name="trash-alt" size={16} color={colors.danger} style={styles.menuIcon} />
          </View>
        </TouchableOpacity>
      </View>

      {/* قسم الحساب */}
      <Text style={styles.sectionLabel}>{t("account", lang)}</Text>
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setEditVisible(true)}>
          <FontAwesome5 name="chevron-left" size={13} color={colors.textMuted} />
          <View style={styles.menuLabelWrap}>
            <Text style={styles.menuText}>{t("edit_profile", lang)}</Text>
            <FontAwesome5 name="user" size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={() => setSubVisible(true)}>
          <FontAwesome5 name="chevron-left" size={13} color={colors.textMuted} />
          <View style={styles.menuLabelWrap}>
            <Text style={styles.menuText}>{t("manage_subscription", lang)}</Text>
            <FontAwesome5 name="credit-card" size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={openPrivacy}>
          <FontAwesome5 name="chevron-left" size={13} color={colors.textMuted} />
          <View style={styles.menuLabelWrap}>
            <Text style={styles.menuText}>{t("privacy_policy", lang)}</Text>
            <FontAwesome5 name="shield-alt" size={16} color={colors.royal} style={styles.menuIcon} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
          <View style={{ width: 13 }} />
          <View style={styles.menuLabelWrap}>
            <Text style={[styles.menuText, { color: colors.danger }]}>{t("sign_out", lang)}</Text>
            <FontAwesome5 name="sign-out-alt" size={16} color={colors.danger} style={styles.menuIcon} />
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 120 }} />

      {/* نافذة تعديل البيانات الشخصية */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <FontAwesome5 name="times" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t("edit_profile_title", lang)}</Text>
            </View>

            <Text style={styles.modalLabel}>{t("display_name", lang)}</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={colors.textMuted}
              textAlign={dir.textAlign}
            />

            <Text style={styles.modalLabel}>{t("email", lang)}</Text>
            <TextInput
              style={styles.modalInput}
              value={editEmail}
              onChangeText={setEditEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
              textAlign={dir.textAlign}
            />
            <Text style={styles.modalHint}>{t("email_verify_note", lang)}</Text>

            <Text style={styles.modalLabel}>{t("new_password", lang)}</Text>
            <TextInput
              style={styles.modalInput}
              value={editPass}
              onChangeText={setEditPass}
              secureTextEntry
              autoCapitalize="none"
              placeholder={t("leave_blank", lang)}
              placeholderTextColor={colors.textMuted}
              textAlign={dir.textAlign}
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveProfile} disabled={savingProfile} activeOpacity={0.85}>
              {savingProfile ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalSaveText}>{t("save", lang)}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* نافذة إدارة الاشتراك المالي */}
      <Modal visible={subVisible} transparent animationType="fade" onRequestClose={() => setSubVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSubVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <FontAwesome5 name="times" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t("sub_title", lang)}</Text>
            </View>

            <View style={styles.planBox}>
              <FontAwesome5 name="crown" size={22} color={colors.platinum} />
              <Text style={styles.planName}>{t("plan_" + planId, lang)}</Text>
              <Text style={styles.planExpiry}>
                {t("expires_on", lang)}: {planExpiry ? planExpiry : t("no_expiry", lang)}
              </Text>
            </View>

            <Text style={styles.modalHint}>{t("sub_renew_note", lang)}</Text>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              activeOpacity={0.85}
              onPress={() => { setSubVisible(false); navigation && navigation.navigate("الاشتراكات"); }}
            >
              <Text style={styles.modalSaveText}>{t("upgrade_now", lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* نافذة سياسة الخصوصية: تمرير صارم، الإغلاق لا يُفعّل إلا بعد قراءة كامل النص */}
      <Modal visible={privacyVisible} transparent animationType="fade" onRequestClose={() => { if (privacyScrolledEnd) setPrivacyVisible(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.privacyCard}>
            <View style={styles.modalHeader}>
              <View style={{ width: 18 }} />
              <Text style={styles.modalTitle}>{t("privacy_title", lang)}</Text>
            </View>

            <ScrollView
              style={styles.privacyScroll}
              contentContainerStyle={styles.privacyScrollContent}
              showsVerticalScrollIndicator={true}
              scrollEventThrottle={16}
              onScroll={onPrivacyScroll}
              onContentSizeChange={(w, h) => { pContentH.current = h; evalPrivacyBottom(); }}
              onLayout={(e) => { pLayoutH.current = e.nativeEvent.layout.height; evalPrivacyBottom(); }}
            >
              <Text style={styles.privacyText}>{t("privacy_body", lang)}</Text>
            </ScrollView>

            {!privacyScrolledEnd && (
              <Text style={styles.privacyHint}>{t("scroll_to_read", lang)}</Text>
            )}

            <TouchableOpacity
              style={[styles.modalSaveBtn, !privacyScrolledEnd && styles.modalSaveBtnDisabled]}
              onPress={() => setPrivacyVisible(false)}
              disabled={!privacyScrolledEnd}
              activeOpacity={0.85}
            >
              <Text style={styles.modalSaveText}>{t("read_done", lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function makeStyles(colors, fontScale, dir) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(10,35,66,0.55)", justifyContent: "center", paddingHorizontal: 24 },
    modalCard: { backgroundColor: colors.bgPure, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.glassBorder },
    modalHeader: { flexDirection: dir.row, alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
    modalTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(17, fontScale), color: colors.onyx, flex: 1, textAlign: dir.textAlign, marginHorizontal: 12 },
    modalLabel: { fontFamily: "Tajawal_700Bold", fontSize: scaled(13, fontScale), color: colors.textDim, marginBottom: 7, marginTop: 12, textAlign: dir.textAlign },
    modalInput: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Tajawal_500Medium", fontSize: scaled(14, fontScale), color: colors.onyx },
    modalHint: { fontFamily: "Tajawal_400Regular", fontSize: scaled(11.5, fontScale), color: colors.textMuted, marginTop: 6, textAlign: dir.textAlign },
    modalSaveBtn: { backgroundColor: colors.royal, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: 22, borderWidth: 1, borderColor: colors.platinum },
    modalSaveBtnDisabled: { opacity: 0.45 },
    modalSaveText: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(15, fontScale), color: colors.white },
    privacyCard: { backgroundColor: colors.bgPure, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.glassBorder, maxHeight: "85%" },
    privacyScroll: { maxHeight: 380, marginTop: 4 },
    privacyScrollContent: { paddingBottom: 8 },
    privacyText: { fontFamily: "Tajawal_500Medium", fontSize: scaled(13.5, fontScale), color: colors.onyx, lineHeight: scaled(24, fontScale), textAlign: dir.textAlign },
    privacyHint: { fontFamily: "Tajawal_500Medium", fontSize: scaled(11.5, fontScale), color: colors.platinum, textAlign: "center", marginTop: 12 },
    planBox: { alignItems: "center", backgroundColor: colors.royalSoft, borderRadius: 18, paddingVertical: 22, borderWidth: 1, borderColor: colors.platinum, marginBottom: 6 },
    planName: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(18, fontScale), color: colors.onyx, marginTop: 10 },
    planExpiry: { fontFamily: "Tajawal_500Medium", fontSize: scaled(12.5, fontScale), color: colors.textDim, marginTop: 6 },
    scrollContent: { paddingTop: 24, paddingHorizontal: 20 },
    headerTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(22, fontScale), color: colors.onyx, textAlign: dir.textAlign, marginBottom: 22 },
    profileCard: {
      flexDirection: dir.row, alignItems: "center", backgroundColor: colors.royal,
      borderRadius: RADIUS.lg, padding: 18, marginBottom: 24,
      shadowColor: "#0A2342", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 6,
    },
    avatarBox: { width: 60, height: 60, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
    profileInfo: { flex: 1, marginRight: 16, alignItems: dir.colStart },
    profileLabel: { fontFamily: "Tajawal_400Regular", fontSize: scaled(12, fontScale), color: "rgba(255,255,255,0.7)" },
    profileEmail: { fontFamily: "Cairo_800ExtraBold", fontSize: scaled(15, fontScale), color: colors.white, marginTop: 4, textAlign: dir.textAlign, width: "100%" },
    sectionLabel: { fontFamily: "Tajawal_700Bold", fontSize: scaled(13, fontScale), color: colors.textDim, textAlign: dir.textAlign, marginBottom: 10, marginRight: 4 },
    menuContainer: {
      backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: 8, marginBottom: 22,
      borderWidth: 1, borderColor: colors.borderSoft,
      shadowColor: "#0A2342", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3,
    },
    menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15 },
    menuLabelWrap: { flexDirection: dir.row, alignItems: "center", flex: 1 },
    menuText: { fontFamily: "Tajawal_700Bold", fontSize: scaled(15, fontScale), color: colors.textBody, textAlign: dir.textAlign },
    menuSubText: { fontFamily: "Tajawal_400Regular", fontSize: scaled(11, fontScale), color: colors.textMuted, textAlign: dir.textAlign, marginTop: 2 },
    menuIcon: { marginLeft: 14, width: 22, textAlign: "center" },
    divider: { height: 1, backgroundColor: colors.borderSoft, marginHorizontal: 10 },
    fontBlock: { padding: 15 },
    fontOptionsRow: { flexDirection: dir.row, marginTop: 14, gap: 8 },
    fontChip: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: RADIUS.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginLeft: 6 },
    fontChipActive: { backgroundColor: colors.royal, borderColor: colors.royal },
    fontChipText: { fontFamily: "Tajawal_700Bold", fontSize: scaled(12.5, fontScale), color: colors.textDim },
    fontChipTextActive: { color: colors.white },
  });
}
