import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useLang } from '../../theme/LanguageContext';

// نصوص الواجهة الثابتة للشاشة (ثنائية اللغة).
const UI = {
  title: { ar: 'المساعد التقديري', en: 'Estimation Assistant' },
  subtitle: { ar: 'شروحات تعريفية لكيفية الاحتساب', en: 'Introductory explanations of how calculations work' },
  topic_sub: { ar: 'شرح تعريفي', en: 'Introductory explanation' },
  disclaimer: {
    ar: 'هذا شرح تعريفي عامّ لكيفية الاحتساب، وليس نتيجة رسمية. تختلف التفاصيل حسب حالتك ونصوص النظام المعمول به، ويُنصح بالرجوع إلى الجهة الرسمية للتأكّد.',
    en: 'This is a general introductory explanation of how calculations work, not an official result. Details vary by your situation and the applicable regulations; please refer to the relevant official authority to confirm.',
  },
};

// محتوى تعليمي ثابت ثنائي اللغة (معادلات عامّة لا تتغيّر إلا بتعديل النظام).
const CALCULATORS = [
  {
    id: 'eos',
    icon: 'briefcase-outline',
    title: { ar: 'مكافأة نهاية الخدمة', en: 'End-of-Service Award' },
    intro: {
      ar: 'مبلغ يستحقّه العامل عند انتهاء علاقة العمل، يُحتسب على أساس الأجر ومدّة الخدمة وفق نظام العمل.',
      en: 'An amount the worker is entitled to at the end of the employment relationship, calculated based on wage and length of service under the labor regulations.',
    },
    sections: [
      {
        h: { ar: 'القاعدة العامّة', en: 'The general rule' },
        lines: [
          { ar: 'أجر نصف شهر عن كل سنة من سنوات الخدمة الخمس الأولى.', en: 'Half a month\u2019s wage for each of the first five years of service.' },
          { ar: 'أجر شهر كامل عن كل سنة من السنوات التالية.', en: 'A full month\u2019s wage for each subsequent year.' },
          { ar: 'تُحسب مدّة الكسور من السنة بنسبتها.', en: 'Partial years are counted proportionally.' },
        ],
      },
      {
        h: { ar: 'اعتبارات تؤثّر في المبلغ', en: 'Factors affecting the amount' },
        lines: [
          { ar: 'سبب انتهاء العلاقة (انتهاء عقد، استقالة، فصل) قد يغيّر الاستحقاق أو نسبته.', en: 'The reason the relationship ended (contract end, resignation, dismissal) may change the entitlement or its rate.' },
          { ar: 'الأجر المعتمد في الاحتساب يشمل عادةً الأجر الأساسي والبدلات الثابتة.', en: 'The wage used in the calculation usually includes the basic wage and fixed allowances.' },
          { ar: 'قد توجد حالات خاصّة (الاستقالة قبل مدد معيّنة) تُعدّل الاستحقاق.', en: 'Special cases (resignation before certain periods) may adjust the entitlement.' },
        ],
      },
    ],
  },
  {
    id: 'gosi',
    icon: 'shield-checkmark-outline',
    title: { ar: 'معاش التأمينات', en: 'Social Insurance Pension' },
    intro: {
      ar: 'المعاش التقاعدي يُحتسب على أساس متوسّط الأجر الخاضع للاشتراك ومدّة الاشتراك وفق نظام التأمينات الاجتماعية.',
      en: 'The retirement pension is calculated based on the average contributory wage and the contribution period under the social insurance regulations.',
    },
    sections: [
      {
        h: { ar: 'الأساس العامّ للاحتساب', en: 'The general basis of calculation' },
        lines: [
          { ar: 'يُعتمد متوسّط الأجر الشهري الخاضع للاشتراك خلال فترة يحدّدها النظام.', en: 'The average monthly contributory wage over a period defined by the regulations is used.' },
          { ar: 'يرتبط مقدار المعاش بعدد سنوات الاشتراك الفعلية.', en: 'The pension amount is tied to the number of actual contribution years.' },
          { ar: 'لكل سنة اشتراك نسبة من متوسّط الأجر تتجمّع لتكوّن المعاش.', en: 'Each contribution year adds a percentage of the average wage that accumulates into the pension.' },
        ],
      },
      {
        h: { ar: 'اعتبارات مؤثّرة', en: 'Influencing factors' },
        lines: [
          { ar: 'بلوغ السنّ النظامية أو استكمال مدّة الاشتراك المطلوبة شرط للاستحقاق.', en: 'Reaching the statutory age or completing the required contribution period is a condition for entitlement.' },
          { ar: 'قد تختلف القواعد بين المعاش المبكّر والمعاش عند السنّ النظامية.', en: 'Rules may differ between early pension and pension at the statutory age.' },
          { ar: 'تُضاف أحياناً مدد اعتبارية أو تُضمّ مدد سابقة وفق ضوابط.', en: 'Nominal periods may sometimes be added, or prior periods merged, under specific rules.' },
        ],
      },
    ],
  },
  {
    id: 'alimony',
    icon: 'people-outline',
    title: { ar: 'النفقة — مبادئ التقدير', en: 'Alimony — Principles of Estimation' },
    intro: {
      ar: 'النفقة تقدير اجتهادي يراعي حاجة المستحقّ ويسر المُنفِق، ولا توجد لها معادلة رقمية ثابتة.',
      en: 'Alimony is a discretionary estimate that considers the recipient\u2019s need and the provider\u2019s means; it has no fixed numerical formula.',
    },
    sections: [
      {
        h: { ar: 'عناصر يُراعيها التقدير', en: 'Elements the estimate considers' },
        lines: [
          { ar: 'حاجة المستحقّ الفعلية (سكن، غذاء, تعليم, علاج).', en: 'The recipient\u2019s actual needs (housing, food, education, treatment).' },
          { ar: 'دخل المُنفِق وقدرته المالية ويُسره أو عُسره.', en: 'The provider\u2019s income, financial capacity, and ease or hardship.' },
          { ar: 'مستوى المعيشة المعتاد, وعدد المستحقّين للنفقة.', en: 'The usual standard of living, and the number of those entitled to support.' },
        ],
      },
      {
        h: { ar: 'ملاحظات مهمّة', en: 'Important notes' },
        lines: [
          { ar: 'التقدير قد يتغيّر بتغيّر الظروف (زيادة الدخل أو الحاجة).', en: 'The estimate may change as circumstances change (a rise in income or need).' },
          { ar: 'يمكن مراجعة قيمة النفقة لاحقاً عند تغيّر الحال.', en: 'The alimony amount can be reviewed later when circumstances change.' },
          { ar: 'لا يوجد رقم ثابت؛ يقدّرها المختصّ حسب كل حالة.', en: 'There is no fixed figure; a specialist estimates it case by case.' },
        ],
      },
    ],
  },
];

export default function EstimatorScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { lang } = useLang();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';
  const [openId, setOpenId] = useState(null);

  const L = (obj) => (obj && obj[lang]) || (obj && obj.ar) || '';
  const active = CALCULATORS.find((c) => c.id === openId) ?? null;

  // عرض موضوع مفتوح
  if (active) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[colors.emerald, colors.emeraldDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.head, { paddingTop: insets.top + 12 }]}
        >
          <Pressable style={styles.back} onPress={() => setOpenId(null)}>
            <Ionicons name="arrow-forward" size={22} color={colors.goldLight} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headTitle, { writingDirection: writingDir }]}>{L(active.title)}</Text>
            <Text style={[styles.headSub, { writingDirection: writingDir }]}>{L(UI.topic_sub)}</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <Text style={[styles.introText, { writingDirection: writingDir }]}>{L(active.intro)}</Text>
          </View>

          {active.sections.map((sec, i) => (
            <View key={i} style={styles.secCard}>
              <View style={styles.secHeadRow}>
                <View style={styles.secBar} />
                <Text style={[styles.secHead, { writingDirection: writingDir }]}>{L(sec.h)}</Text>
              </View>
              {sec.lines.map((ln, j) => (
                <View key={j} style={styles.lineRow}>
                  <Ionicons name="ellipse" size={6} color={colors.gold} style={{ marginTop: 8 }} />
                  <Text style={[styles.lineText, { writingDirection: writingDir }]}>{L(ln)}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.discBar}>
            <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
            <Text style={[styles.discText, { writingDirection: writingDir }]}>{L(UI.disclaimer)}</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // قائمة المواضيع
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.emerald, colors.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.head, { paddingTop: insets.top + 16 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.headTitle, { writingDirection: writingDir }]}>{L(UI.title)}</Text>
          <Text style={[styles.headSub, { writingDirection: writingDir }]}>
            {L(UI.subtitle)}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {CALCULATORS.map((c) => (
          <Pressable key={c.id} style={styles.calcCard} onPress={() => setOpenId(c.id)}>
            <View style={styles.calcIcon}>
              <Ionicons name={c.icon} size={22} color={colors.goldLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.calcTitle, { writingDirection: writingDir }]}>{L(c.title)}</Text>
              <Text style={[styles.calcIntro, { writingDirection: writingDir }]} numberOfLines={2}>
                {L(c.intro)}
              </Text>
            </View>
            <Ionicons name="chevron-back" size={20} color={colors.muted} />
          </Pressable>
        ))}

        <Text style={[styles.footnote, { writingDirection: writingDir }]}>{L(UI.disclaimer)}</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 20,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headTitle: { fontFamily: 'Cairo_700Bold', fontSize: 21, color: '#FFFFFF' },
  headSub: { fontFamily: 'Tajawal_500Medium', fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  body: { padding: 18, paddingBottom: 40 },
  calcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 13,
    boxShadow: '0px 4px 12px 0px rgba(10,42,27,0.05)',
  },
  calcIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcTitle: { fontFamily: 'Cairo_700Bold', fontSize: 15.5, color: colors.textDark },
  calcIntro: { fontFamily: 'Tajawal_400Regular', fontSize: 12.5, color: colors.muted, marginTop: 4, lineHeight: 19 },
  introCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  introText: { fontFamily: 'Tajawal_500Medium', fontSize: 14, color: colors.textBody, lineHeight: 24 },
  secCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  secHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
  secBar: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  secHead: { fontFamily: 'Cairo_700Bold', fontSize: 15, color: colors.emerald },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  lineText: { flex: 1, fontFamily: 'Tajawal_400Regular', fontSize: 13.5, color: colors.textBody, lineHeight: 23 },
  discBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    backgroundColor: 'rgba(201,162,39,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(201,162,39,0.25)',
    borderRadius: 12,
    padding: 13,
    marginTop: 4,
  },
  discText: { flex: 1, fontFamily: 'Tajawal_400Regular', fontSize: 11.5, color: colors.textBody, lineHeight: 19 },
  footnote: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 11.5,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },
});
