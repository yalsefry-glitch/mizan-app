// ===== الهوية البصرية لميزان: الزمردي الذهبي (Emerald Gold) =====
// MIZAN v12 | React Native (Android + iOS)
// أسماء المتغيّرات القديمة (royal/gold/navy) محفوظة بقيم زمردية لمنع كسر الشاشات.

// ============ نظام الثيمات الأربعة ============
// كل ثيم يحوي كل ما قد تطلبه أي شاشة: تدرّج (g1-g4) + ألوان + خلفيات (bg/surface/border).
export const THEMES = {
  emerald: {
    id: "emerald", name: "زمردي", label: "Emerald / Gold",
    g1: "#0F5132", g2: "#0A3D26", g3: "#125E3A", g4: "#08311E",
    primary: "#0F5132", primaryDeep: "#0A3D26",
    accent: "#C9A227", accentLite: "#E3C766",
    light: "rgba(15,81,50,0.10)",
    bg: "#FBFCFA", bgPure: "#FFFFFF", surface: "#FFFFFF",
    border: "#E3EFE8", royalSoft: "#F0F7F3",
    ink: "#0A2A1B", inkDim: "#43655A", muted: "#8FB1A2",
    onGrad: "#FFFFFF", onGradDim: "rgba(255,255,255,0.85)",
  },
  midnight: {
    id: "midnight", name: "ليل", label: "Midnight / Silver",
    g1: "#1E293B", g2: "#0F172A", g3: "#283548", g4: "#0B1120",
    primary: "#334155", primaryDeep: "#0F172A",
    accent: "#94A3B8", accentLite: "#E2E8F0",
    light: "rgba(51,65,85,0.10)",
    bg: "#F7F8FA", bgPure: "#FFFFFF", surface: "#FFFFFF",
    border: "#E7EAF0", royalSoft: "#F1F5F9",
    ink: "#0F172A", inkDim: "#475569", muted: "#94A3B8",
    onGrad: "#FFFFFF", onGradDim: "rgba(255,255,255,0.85)",
  },
  ocean: {
    id: "ocean", name: "محيط", label: "Ocean / Teal",
    g1: "#0D9488", g2: "#0F766E", g3: "#14B8A6", g4: "#0A5C55",
    primary: "#0D9488", primaryDeep: "#0F766E",
    accent: "#0E7490", accentLite: "#5EEAD4",
    light: "rgba(13,148,136,0.10)",
    bg: "#F7FCFB", bgPure: "#FFFFFF", surface: "#FFFFFF",
    border: "#DDF0ED", royalSoft: "#ECFBF8",
    ink: "#0A2A28", inkDim: "#42655F", muted: "#8DB3AE",
    onGrad: "#FFFFFF", onGradDim: "rgba(255,255,255,0.85)",
  },
  sand: {
    id: "sand", name: "رمل", label: "Sand / Brown",
    g1: "#A8763E", g2: "#7C5226", g3: "#B98A4D", g4: "#5E3D1A",
    primary: "#7C5226", primaryDeep: "#5E3D1A",
    accent: "#9C6B2E", accentLite: "#E8C99A",
    light: "rgba(124,82,38,0.12)",
    bg: "#FBF8F2", bgPure: "#FFFFFF", surface: "#FFFFFF",
    border: "#EDE3D2", royalSoft: "#FAF3E8",
    ink: "#3A2A16", inkDim: "#6B5A42", muted: "#A89B82",
    onGrad: "#FFFFFF", onGradDim: "rgba(255,255,255,0.85)",
  },
};

export const DEFAULT_THEME = "emerald";

// ============ COLORS — لوحة ثابتة (متوافقة مع الشاشات القديمة) ============
export const COLORS = {
  bg: "#FBFCFA", bgPure: "#FFFFFF", surface: "#FFFFFF",
  onyx: "#0A2A1B", textDark: "#0A2A1B", textBody: "#1C3A2E", textDim: "#43655A", textMuted: "#8FB1A2",
  royal: "#0F5132", royalLight: "#125E3A", royalDeep: "#0A3D26", royalSoft: "#F0F7F3",
  platinum: "#C9A227", platinumLite: "#E3C766",
  border: "#E3EFE8", borderSoft: "#EEF5F1",
  glass: "rgba(255,255,255,0.92)", glassBorder: "rgba(201,162,39,0.30)",
  white: "#FFFFFF", danger: "#991B1B", green: "#0F5132",
  // أسماء التوافق القديمة (يمنع حذفها) — قيم زمردية
  navy1: "#0F5132", navy2: "#0A3D26", navyDark: "#08311E", navyMid: "#0A2A1B",
  gold: "#C9A227", goldLight: "#E3C766", text: "#0A2A1B", cardBg: "#FFFFFF",
};

export const SHADOW = {
  card: { shadowColor: "#0F5132", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4 },
  soft: { shadowColor: "#0F5132", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  button: { shadowColor: "#0F5132", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 5 },
  grad: { shadowColor: "#0F5132", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 10 },
};

export const RADIUS = { sm: 14, md: 20, lg: 26, xl: 32 };

export const TAGLINE = "إرشاد توعوي بالأنظمة والإجراءات السعودية";
export const APP_NAME = "MIZAN";
export const APP_NAME_AR = "مِيزان";
export const APP_SUB = "مساعدك الذكي للإرشاد التوعوي بالأنظمة والإجراءات السعودية";

// ============ المحاور الثمانية (تضم 25 خبيراً) ============
export const HUBS = [
  { id: "security", title: "الأمن والبلاغات", sub: "الشرطة والبلاغات", icon: "shield-alt",
    experts: [
      { id: "police", title: "مراكز الشرطة", sub: "بلاغات ومحاضر" },
      { id: "kollona", title: "كلنا أمن", sub: "البلاغات الأمنية" },
      { id: "cyber", title: "الجرائم المعلوماتية", sub: "ابتزاز وتشهير إلكتروني" },
    ] },
  { id: "prosecution", title: "النيابة والضبط الجنائي", sub: "تحقيق وعقوبات", icon: "gavel",
    experts: [
      { id: "niyaba", title: "النيابة العامة", sub: "تحقيق واستدعاء وإحالة" },
      { id: "criminal", title: "الخبير الجنائي", sub: "جرائم وعقوبات وحقوق المتهم" },
    ] },
  { id: "judiciary", title: "القضاء وناجز", sub: "محاكم ووكالات", icon: "balance-scale-right",
    experts: [
      { id: "najiz", title: "ناجز والمحاكم", sub: "دعاوى ووكالات وتنفيذ" },
      { id: "taradhi", title: "منصة تراضي", sub: "تسويات وصلح ودّي" },
    ] },
  { id: "family", title: "الأحوال والأسرة", sub: "طلاق وحضانة ونفقة", icon: "users",
    experts: [
      { id: "family_law", title: "الأحوال الشخصية", sub: "زواج، طلاق، خلع، عِدّة" },
      { id: "custody", title: "الحضانة والنفقة", sub: "حضانة، رؤية، نفقة" },
      { id: "inherit", title: "الميراث والوصية", sub: "أنصبة، وصية، ولاية" },
    ] },
  { id: "finance", title: "المال والضمان", sub: "بنوك وتأمين وضمان", icon: "landmark",
    experts: [
      { id: "sama", title: "ساما تهتم", sub: "بنوك وتمويل واحتيال مالي" },
      { id: "citizen", title: "حساب المواطن والضمان", sub: "أهلية واعتراضات" },
      { id: "gosi", title: "التأمينات الاجتماعية", sub: "تقاعد وإصابات عمل" },
      { id: "health_ins", title: "الضمان الصحي", sub: "تأمين طبي ومطالبات" },
      { id: "commercial_ins", title: "خبير التأمين التجاري", sub: "السيارات، الممتلكات، المسؤوليات المهنية للشركات" },
    ] },
  { id: "labor", title: "العمل والأفراد", sub: "قوى وأبشر ومساند", icon: "briefcase",
    experts: [
      { id: "qiwa", title: "قوى ونظام العمل", sub: "عقود وعلاقات عمالية" },
      { id: "absher", title: "أبشر والأحوال المدنية", sub: "أفراد وجوازات وخدمات" },
      { id: "musaned", title: "منصة مساند", sub: "العمالة المنزلية" },
    ] },
  { id: "realestate", title: "العقار والسكن", sub: "إيجار وتملّك عقاري", icon: "key",
    experts: [
      { id: "ejar", title: "منصة إيجار", sub: "عقود سكنية وإخلاء" },
      { id: "ehkam", title: "منصة إحكام", sub: "تملّك العقارات" },
      { id: "mullak", title: "منصة مُلّاك", sub: "إدارة اتحاد المُلّاك" },
      { id: "wafi", title: "العقود الهندسية ووافي", sub: "استصناع ومقاولات" },
    ] },
  { id: "commerce", title: "التجارة والزكاة", sub: "تجارة وزكاة وضريبة", icon: "store",
    experts: [
      { id: "balady", title: "منصة بلدي", sub: "تراخيص ونشاط تجاري" },
      { id: "commerce_p", title: "التجارة ومنصة الأعمال", sub: "شركات وحماية مستهلك" },
      { id: "zatca", title: "الزكاة والضريبة والجمارك", sub: "فوترة وإقرارات (ZATCA)" },
    ] },
];

// خريطة الخبير → المحور (للدساتير لاحقاً)
export const EXPERTS_INDEX = (() => {
  const map = {};
  HUBS.forEach((hub) => {
    (hub.experts || []).forEach((ex) => { map[ex.id] = { ...ex, hubId: hub.id, hubTitle: hub.title }; });
  });
  return map;
})();

export const EXPERTS_COUNT = HUBS.reduce((n, h) => n + (h.experts ? h.experts.length : 0), 0);

// ============ المساعد التقديري (الأدوات) ============
export const TOOLS = [
  { id: "calculators", title: "الحاسبات التقديرية", sub: "مكافأة، نفقة، ميراث، رسوم", icon: "calculator" },
  { id: "deadlines", title: "تنبيهات المهل", sub: "تذكير التجديد والجلسات", icon: "bell" },
];

// ============ التوافق العكسي: SECTIONS ============
export const SECTIONS = HUBS.map((h) => ({ id: h.id, title: h.title, sub: h.sub, icon: h.icon }));

// ============ المنصات الرسمية ============
export const PLATFORMS = [
  { id: "najiz", name: "ناجز", url: "https://najiz.sa" },
  { id: "qiwa", name: "قوى", url: "https://qiwa.sa" },
  { id: "ejar", name: "إيجار", url: "https://www.ejar.sa" },
  { id: "absher", name: "أبشر", url: "https://www.absher.sa" },
  { id: "gosi", name: "التأمينات", url: "https://www.gosi.gov.sa" },
  { id: "etimad", name: "اعتماد", url: "https://etimad.sa" },
  { id: "balady", name: "بلدي", url: "https://balady.gov.sa" },
  { id: "moj", name: "وزارة العدل", url: "https://www.moj.gov.sa" },
  { id: "zatca", name: "هيئة الزكاة والضريبة والجمارك", url: "https://zatca.gov.sa" },
];
