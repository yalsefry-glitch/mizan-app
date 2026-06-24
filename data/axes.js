// محاور ميزان السبعة ومساعدوها — مطابقة لقاعدة البيانات (جدول assistants)
// كل خبير: { id: معرّف المساعد في الخادم, name: اسمه العربي }
export const axes = [
  {
    id: 'family',
    title: 'الأسرة والأحوال',
    icon: 'people-outline',
    experts: [
      { id: 'family_civil_affairs', name: 'الأحوال المدنية' },
      { id: 'family_marriage', name: 'الزواج والتوثيق' },
      { id: 'family_divorce', name: 'الطلاق والخلع' },
      { id: 'family_custody', name: 'الحضانة والرؤية' },
      { id: 'family_alimony', name: 'النفقة' },
      { id: 'family_reconciliation', name: 'الصلح والتراضي الأسري' },
      { id: 'family_protection', name: 'العنف الأسري والحماية' },
    ],
  },
  {
    id: 'labor',
    title: 'العمل والأفراد',
    icon: 'briefcase-outline',
    experts: [
      { id: 'qiwa_contracts', name: 'قوى والعقود' },
      { id: 'mudad', name: 'مُدد' },
      { id: 'labor_complaints', name: 'الشكاوى العمالية' },
      { id: 'musaned', name: 'العمالة المنزلية (مساند)' },
      { id: 'social_insurance', name: 'التأمينات الاجتماعية' },
      { id: 'passports_residency', name: 'الجوازات والإقامة' },
    ],
  },
  {
    id: 'finance',
    title: 'المال والتعاملات',
    icon: 'cash-outline',
    experts: [
      { id: 'banks_sama', name: 'البنوك والساما' },
      { id: 'support_daman', name: 'الدعم والضمان' },
      { id: 'claims_enforcement', name: 'المطالبات والتنفيذ' },
      { id: 'cheques_commercial_papers', name: 'الشيكات والأوراق التجارية' },
      { id: 'default_bankruptcy', name: 'التعثّر والإفلاس' },
    ],
  },
  {
    id: 'judicial',
    title: 'المساعد العدلي',
    icon: 'business-outline',
    experts: [
      { id: 'judicial_litigation', name: 'المنصّات العدلية والتقاضي' },
      { id: 'judicial_documentation', name: 'التوثيق والتصديق' },
      { id: 'judicial_reconciliation', name: 'الصلح والتراضي القضائي العام' },
      { id: 'judicial_objections', name: 'الاعتراض والمهل والاستحقاقات' },
    ],
  },
  {
    id: 'cyber',
    title: 'الجرائم المعلوماتية والاحتيال',
    icon: 'shield-outline',
    experts: [
      { id: 'financial_fraud', name: 'الاحتيال المالي الرقمي' },
      { id: 'electronic_extortion', name: 'الابتزاز الإلكتروني' },
      { id: 'identity_hacking', name: 'انتحال الهوية والاختراق' },
      { id: 'post_report', name: 'ما بعد البلاغ' },
    ],
  },
  {
    id: 'emergency',
    title: 'الطوارئ والحوادث',
    icon: 'alert-circle-outline',
    experts: [
      { id: 'traffic_accidents', name: 'الحوادث المرورية' },
      { id: 'traffic_violations', name: 'المخالفات والاعتراض المروري' },
      { id: 'emergency_firstaid', name: 'الطوارئ والإسعاف' },
      { id: 'vehicle_insurance', name: 'التأمين على المركبات' },
    ],
  },
  {
    id: 'development',
    title: 'تطويرك',
    icon: 'trending-up-outline',
    experts: [
      { id: 'career_path', name: 'المسارات المهنية والترقيات' },
      { id: 'professional_certs', name: 'الشهادات والتأهيل المهني' },
      { id: 'entrepreneurship', name: 'ريادة الأعمال والمنشآت' },
    ],
  },
];
