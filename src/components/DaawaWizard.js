import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";
import { askAI } from "../lib/api";
import { useTheme, scaled } from "../lib/ThemeContext";
import { t } from "../lib/i18n";
import AuthScreen from "../screens/AuthScreen";

const { width } = Dimensions.get("window");

export default function DaawaWizard({ onClose, onSaveSuccess }) {
  const { colors, fontScale, lang, dir } = useTheme();
  const styles = makeStyles(colors, fontScale, dir);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [formData, setFormData] = useState({
    type: "حقوقية عامة",
    plaintiff: "",
    defendant: "",
    details: "",
  });

  const [generatedText, setGeneratedText] = useState("");

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      generateDaawa();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const generateDaawa = async () => {
    setLoading(true);
    setStep(4);

    // الدستور القانوني الصارم: يمنع نقل الألفاظ السوقية ويفرض الصياغة القضائية الرصينة
    const legalCharter =
      "انت مستشار قانوني سعودي محترف وكاتب صحف دعاوى. " +
      "يمنع منعا باتا نقل او استخدام الالفاظ العامية او الشتائم او العبارات السوقية التي يدخلها المستخدم في وصف وقائعه. " +
      "مهمتك الحصرية استخلاص الوقائع المجردة واعادة صياغتها بلغة قانونية رصينة وموضوعية تتوافق مع نظام المرافعات الشرعية السعودي، وتحويل اي اساءة او لفظ سوقي الى وصف قانوني مجرد ومحايد (مثال: تحويل عبارة مهين الى تعدى بالقول، وتحويل الشتيمة الى الفاظ ماسة بالكرامة). " +
      "اكتب صحيفة دعوى رسمية كاملة مرتبة: الديباجة ومخاطبة المحكمة المختصة، ثم اطراف الدعوى، ثم الوقائع المصاغة قانونيا، ثم قسم الاسانيد واللوائح النظامية، ثم الطلبات المرقمة، ثم خاتمة رسمية. " +
      "لا تخترع مواد نظامية غير مؤكدة، واكتب نصا نظيفا بلا رموز تنسيق.";

    const userData =
      "نوع المحكمة والاختصاص: " + formData.type + "\n" +
      "المدعي: " + formData.plaintiff + "\n" +
      "المدعى عليه: " + formData.defendant + "\n" +
      "وقائع القضية كما يصفها المستخدم (قد تحتوي الفاظا عامية يجب تهذيبها قانونيا): " + formData.details;

    try {
      const ans = await askAI(legalCharter + "\n\n" + userData, "sayigh_daawa", []);
      setGeneratedText(ans || t("daawa_gen_err", lang));
    } catch (e) {
      setGeneratedText(t("daawa_gen_err", lang));
    }
    setLoading(false);
  };

  const saveToLibrary = async () => {
    setSaveLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setShowAuthModal(true);
        setSaveLoading(false);
        return;
      }

      const { error } = await supabase
        .from("user_library")
        .insert([
          {
            user_id: user.id,
            title: `صحيفة دعوى ${formData.type} - الخصم: ${formData.defendant}`,
            content: generatedText,
            document_type: "ناجز - صحيفة دعوى",
          },
        ]);

      if (error) throw error;

      Alert.alert(t("daawa_saved_title", lang), t("daawa_saved_msg", lang));
      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (error) {
      Alert.alert(t("daawa_save_err", lang), error.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setTimeout(() => {
      saveToLibrary();
    }, 500);
  };

  return (
    <View style={styles.wizardOverlay}>
      <View style={styles.wizardContainer}>

        <View style={styles.wizardHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={14} color={colors.royal} />
          </TouchableOpacity>
          <Text style={styles.wizardTitle}>{t("daawa_wizard_title", lang)}</Text>
        </View>

        {step <= 3 && (
          <View style={styles.progressRow}>
            {[1, 2, 3].map((s) => (
              <View key={s} style={styles.stepIndicatorWrapper}>
                <View style={[styles.stepDot, step >= s ? styles.stepDotActive : styles.stepDotInactive]} />
                {s < 3 && <View style={[styles.stepLine, step > s ? styles.stepLineActive : styles.stepLineInactive]} />}
              </View>
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.wizardScroll} showsVerticalScrollIndicator={false}>

          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>{t("daawa_step1", lang)}</Text>
              {[{v:"حقوقية عامة",k:"court_general"},{v:"عمالية (منصة قوى)",k:"court_labor"},{v:"تجاري واستثماري",k:"court_commercial"},{v:"أحوال شخصية",k:"court_personal"}].map((ct) => (
                <TouchableOpacity
                  key={ct.v}
                  style={[styles.radioOption, formData.type === ct.v && styles.radioOptionActive]}
                  onPress={() => setFormData({ ...formData, type: ct.v })}
                >
                  <Text style={[styles.radioText, formData.type === ct.v && styles.radioTextActive]}>{t(ct.k, lang)}</Text>
                  <View style={[styles.radioCircle, formData.type === ct.v && styles.radioCircleActive]} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>{t("daawa_step2", lang)}</Text>
              <Text style={styles.inputTitle}>{t("daawa_plaintiff", lang)}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t("daawa_plaintiff_ph", lang)}
                placeholderTextColor={colors.textMuted}
                value={formData.plaintiff}
                onChangeText={(text) => setFormData({ ...formData, plaintiff: text })}
                textAlign="right"
              />
              <Text style={styles.inputTitle}>{t("daawa_defendant", lang)}</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t("daawa_defendant_ph", lang)}
                placeholderTextColor={colors.textMuted}
                value={formData.defendant}
                onChangeText={(text) => setFormData({ ...formData, defendant: text })}
                textAlign="right"
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.stepLabel}>{t("daawa_step3", lang)}</Text>
              <Text style={styles.inputTitle}>{t("daawa_details_label", lang)}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={t("daawa_details_ph", lang)}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={6}
                value={formData.details}
                onChangeText={(text) => setFormData({ ...formData, details: text })}
                textAlign="right"
              />
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContent}>
              {loading ? (
                <View style={styles.loadingWrapper}>
                  <ActivityIndicator size="large" color={colors.royal} />
                  <Text style={styles.loadingText}>{t("daawa_loading", lang)}</Text>
                </View>
              ) : (
                <View style={styles.resultWrapper}>
                  <Text style={styles.stepLabel}>{t("daawa_final_label", lang)}</Text>
                  <View style={styles.docScrollBox}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <Text style={styles.docOutputText}>{generatedText}</Text>
                    </ScrollView>
                  </View>
                  <TouchableOpacity
                    style={styles.saveLibraryButton}
                    onPress={saveToLibrary}
                    disabled={saveLoading}
                  >
                    <View style={styles.saveGradient}>
                      {saveLoading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Text style={styles.saveText}>{t("daawa_save", lang)}</Text>
                          <FontAwesome5 name="cloud-upload-alt" size={14} color={colors.white} style={{ marginLeft: 8 }} />
                        </>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {(!loading && step <= 4) && (
          <View style={styles.wizardFooter}>
            {step < 4 ? (
              <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Text style={styles.nextButtonText}>{step === 3 ? t("daawa_generate", lang) : t("next", lang)}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.nextButton, { backgroundColor: colors.royalSoft }]} onPress={onClose}>
                <Text style={[styles.nextButtonText, { color: colors.royal }]}>{t("daawa_close", lang)}</Text>
              </TouchableOpacity>
            )}
            {step > 1 && step < 4 && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                <Text style={styles.backButtonText}>{t("daawa_back", lang)}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={showAuthModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bgPure }}>
          <View style={styles.modalHeaderCloseRow}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowAuthModal(false)}>
              <Text style={styles.modalCloseButtonText}>{t("daawa_undo", lang)}</Text>
              <FontAwesome5 name="arrow-right" size={14} color={colors.royal} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
          <AuthScreen onAuthSuccess={handleAuthSuccess} />
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors, fontScale, dir = { isRTL: true, row: "row-reverse", rowStart: "flex-end" }) {
  return StyleSheet.create({
  wizardOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: "rgba(10,35,66,0.45)", justifyContent: "flex-end" },
  wizardContainer: { width: "100%", height: "88%", borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: colors.border, overflow: "hidden", backgroundColor: colors.bgPure },
  wizardHeader: { flexDirection: "row", alignItems: "center", padding: 20, borderBottomWidth: 1, borderColor: colors.borderSoft, justifyContent: "space-between" },
  closeButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.royalSoft, alignItems: "center", justifyContent: "center" },
  wizardTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: 14.5, color: colors.royal },
  progressRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginVertical: 18, width: "100%" },
  stepIndicatorWrapper: { flexDirection: "row", alignItems: "center" },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: colors.royal },
  stepDotInactive: { backgroundColor: colors.border },
  stepLine: { height: 2, width: 65, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: colors.royal },
  stepLineInactive: { backgroundColor: colors.border },
  wizardScroll: { padding: 20, paddingBottom: 40 },
  stepContent: { width: "100%", alignItems: "flex-end" },
  stepLabel: { fontFamily: "Cairo_800ExtraBold", fontSize: 15.5, color: colors.onyx, marginBottom: 16, textAlign: "right", width: "100%" },
  radioOption: { flexDirection: dir.row, alignItems: "center", justifyContent: dir.rowStart, width: "100%", height: 50, backgroundColor: colors.bg, borderRadius: 14, paddingHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.borderSoft },
  radioOptionActive: { borderColor: colors.royal, backgroundColor: colors.royalSoft },
  radioText: { fontFamily: "Tajawal_500Medium", fontSize: 13.5, color: colors.textDim, marginHorizontal: 12 },
  radioTextActive: { color: colors.royal, fontFamily: "Tajawal_700Bold" },
  radioCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textMuted },
  radioCircleActive: { borderColor: colors.royal, backgroundColor: colors.royal },
  inputTitle: { fontFamily: "Tajawal_700Bold", fontSize: 12.5, color: colors.textDim, marginBottom: 6, marginTop: 12, textAlign: "right", width: "100%" },
  textInput: { width: "100%", height: 48, backgroundColor: colors.bg, borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 16, color: colors.onyx, fontFamily: "Tajawal_500Medium", fontSize: 13, textAlign: "right" },
  textArea: { height: 120, paddingTop: 12, textAlignVertical: "top" },
  loadingWrapper: { width: "100%", alignItems: "center", paddingVertical: 40 },
  loadingText: { fontFamily: "Tajawal_500Medium", fontSize: 13, color: colors.textDim, marginTop: 16, textAlign: "center" },
  resultWrapper: { width: "100%", alignItems: "flex-end" },
  docScrollBox: { width: "100%", height: 260, backgroundColor: colors.bg, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, padding: 16, marginBottom: 20 },
  docOutputText: { fontFamily: "Tajawal_500Medium", fontSize: 13.5, color: colors.textBody, lineHeight: 22, textAlign: "right" },
  saveLibraryButton: { width: "100%", height: 50, borderRadius: 14, overflow: "hidden" },
  saveGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.royal },
  saveText: { fontFamily: "Cairo_800ExtraBold", fontSize: 14, color: colors.white },
  wizardFooter: { flexDirection: dir.row, justifyContent: "space-between", alignItems: "center", padding: 20, borderTopWidth: 1, borderColor: colors.borderSoft, paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  nextButton: { height: 46, paddingHorizontal: 28, backgroundColor: colors.royal, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nextButtonText: { fontFamily: "Cairo_800ExtraBold", fontSize: 13.5, color: colors.white },
  backButton: { height: 46, paddingHorizontal: 20, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
  backButtonText: { fontFamily: "Tajawal_700Bold", fontSize: 13.5, color: colors.textDim },
  });
};
