import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Platform, TextInput } from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { HUBS, TOOLS, EXPERTS_COUNT, COLORS, RADIUS, THEMES, DEFAULT_THEME, APP_NAME_AR, APP_SUB } from "../lib/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 44) / 2; // 16 padding على الجانبين + 12 gap

// الثيم النشط (الزمردي افتراضياً). لاحقاً يُقرأ من حالة عامة عند تفعيل مبدّل الثيمات.
const TH = THEMES[DEFAULT_THEME];

export default function HomeScreen({ navigation }) {
  const openHub = (hub) => {
    navigation.navigate("Section", { section: hub });
  };
  const openTool = (tool) => {
    navigation.navigate("Section", { section: tool });
  };

  return (
    <View style={styles.container}>
      {/* ===== الهيدر العلوي بتدرّج زمردي ===== */}
      <LinearGradient
        colors={[TH.g1, TH.g2, TH.g3, TH.g4]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          {/* أيقونة الميزان (شعار) */}
          <View style={styles.brand}>
            <View style={styles.logo}>
              <FontAwesome5 name="balance-scale" size={24} color={TH.accentLite} />
            </View>
            <Text style={styles.brandName}>
              مِيزَ<Text style={{ color: TH.accentLite }}>ان</Text>
            </Text>
          </View>
          {/* أزرار الهيدر: الجرس + اللغة (نسخة كربونية 40×40) */}
          <View style={styles.headActions}>
            <TouchableOpacity style={styles.hbtn} activeOpacity={0.8}>
              <FontAwesome5 name="bell" size={16} color="#fff" />
              <View style={styles.badge} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.hbtn} activeOpacity={0.8}>
              <Text style={styles.langText}>En</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.brandSub} numberOfLines={1}>{APP_SUB}</Text>

        {/* مربع البحث داخل الهيدر */}
        <View style={styles.search}>
          <FontAwesome5 name="search" size={15} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن خبير أو إجراء أو نظام..."
            placeholderTextColor={COLORS.textMuted}
            textAlign="right"
          />
        </View>
      </LinearGradient>

      {/* ===== المحتوى القابل للتمرير ===== */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.sectionTitleRow}>
          <View style={styles.miniDot} />
          <Text style={styles.sectionTitleText}>المحاور الذكية</Text>
          <Text style={styles.sectionCount}>{"٨ محاور · " + EXPERTS_COUNT + " خبيراً"}</Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            <Text style={styles.noteBold}>إرشاد توعوي وإجرائي</Text>
            {" — كل محور يضم خبراء متخصصين بمنصات وجهات سعودية. ليس بديلاً عن محامٍ مرخص."}
          </Text>
        </View>

        {/* شبكة المحاور الثمانية (2×4) */}
        <View style={styles.grid}>
          {HUBS.map((hub) => (
            <TouchableOpacity
              key={hub.id}
              style={styles.cardTouch}
              activeOpacity={0.9}
              onPress={() => openHub(hub)}
            >
              <View style={styles.cardInner}>
                <View style={styles.iconContainer}>
                  <FontAwesome5 name={hub.icon} size={22} color={TH.primary} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{hub.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={1}>{hub.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* المساعد التقديري (الأدوات) */}
        <View style={styles.toolsLabelRow}>
          <View style={[styles.miniDot, { backgroundColor: TH.primary }]} />
          <Text style={styles.sectionTitleText}>المساعد التقديري</Text>
        </View>

        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              style={styles.cardTouch}
              activeOpacity={0.9}
              onPress={() => openTool(tool)}
            >
              <View style={[styles.cardInner, styles.toolCard]}>
                <View style={styles.iconContainer}>
                  <FontAwesome5 name={tool.icon} size={22} color={TH.primary} />
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{tool.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={1}>{tool.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // الهيدر
  header: {
    paddingTop: Platform.OS === "ios" ? 56 : 44,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: "#0F5132", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 24, elevation: 10,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
    marginLeft: 11,
  },
  brandName: { fontFamily: "Cairo_800ExtraBold", fontSize: 25, color: "#fff", letterSpacing: 0.4 },
  headActions: { flexDirection: "row", alignItems: "center" },
  // زر الهيدر الموحّد 40×40 (نسخة كربونية)
  hbtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
    marginLeft: 8,
  },
  langText: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#fff" },
  badge: {
    position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: TH.accentLite, borderWidth: 1.5, borderColor: TH.g1,
  },
  brandSub: { fontFamily: "Tajawal_500Medium", fontSize: 11.5, color: "rgba(255,255,255,0.85)", textAlign: "right", marginTop: 6 },
  search: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 15,
    paddingHorizontal: 15, paddingVertical: Platform.OS === "ios" ? 14 : 4,
    marginTop: 14, gap: 11,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 12,
  },
  searchInput: { flex: 1, fontFamily: "Tajawal_500Medium", fontSize: 13.5, color: COLORS.onyx, textAlign: "right" },

  // المحتوى
  scrollContent: { paddingHorizontal: 16, paddingTop: 18 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  sectionTitleText: { fontFamily: "Cairo_800ExtraBold", fontSize: 16, color: COLORS.onyx },
  miniDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.platinum, marginLeft: 9 },
  sectionCount: { fontFamily: "Tajawal_500Medium", fontSize: 11, color: COLORS.textMuted, marginRight: "auto" },

  note: {
    backgroundColor: COLORS.royalSoft, borderRadius: 14, padding: 13, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  noteText: { fontFamily: "Tajawal_400Regular", fontSize: 11.5, color: COLORS.textDim, textAlign: "right", lineHeight: 19 },
  noteBold: { fontFamily: "Tajawal_700Bold", color: COLORS.royal },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  cardTouch: { width: CARD_WIDTH, marginBottom: 12 },
  // بطاقة المحور: خلفية بيضاء، ارتفاع ثابت 140، حد ذهبي رقيق، ظل ناعم
  cardInner: {
    backgroundColor: COLORS.surface, borderRadius: 22, padding: 16,
    height: 140, alignItems: "flex-end", justifyContent: "flex-start",
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: "#0F5132", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 4,
  },
  // بطاقة الأدوات: نفس الشكل، حد ذهبي مميّز
  toolCard: { borderColor: COLORS.glassBorder },
  iconContainer: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.royalSoft,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  cardTitle: { fontFamily: "Cairo_800ExtraBold", fontSize: 13.5, color: COLORS.onyx, textAlign: "right", width: "100%" },
  cardDesc: { fontFamily: "Tajawal_500Medium", fontSize: 11, color: COLORS.textDim, textAlign: "right", width: "100%", marginTop: 3 },

  toolsLabelRow: { flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 14 },
});
