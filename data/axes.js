// محاور ميزان السبعة ومساعدوها — مطابقة لقاعدة البيانات (جدول assistants)
// كل خبير: { id: معرّف المساعد في الخادم, name: اسمه المعروض }
// الأسماء بهوية «ميزان ×» (بلا أسماء جهات رسمية). المعرّفات (id) ثابتة لا تتغيّر
// حفاظاً على ربط الدساتير في الخادم — عدا تقسيم المطالبات/التنفيذ (معرّفان جديدان).
export const axes = [
  {
    id: 'family',
    title: 'الأسرة والأحوال',
    icon: 'people-outline',
    experts: [
      { id: 'family_civil_affairs', name: 'ميزان الهوية' },
      { id: 'family_marriage', name: 'ميزان الزواج' },
      { id: 'family_divorce', name: 'ميزان الطلاق' },
      { id: 'family_custody', name: 'ميزان الحضانة' },
      { id: 'family_alimony', name: 'ميزان النفقة' },
      { id: 'family_reconciliation', name: 'ميزان الصلح الأسري' },
      { id: 'family_protection', name: 'ميزان الحماية الأسرية' },
    ],
  },
  {
    id: 'labor',
    title: 'العمل والأفراد',
    icon: 'briefcase-outline',
    experts: [
      { id: 'qiwa_contracts', name: 'ميزان عقود العمل' },
      { id: 'mudad', name: 'ميزان الأجور' },
      { id: 'labor_complaints', name: 'ميزان الشكاوى العمالية' },
      { id: 'musaned', name: 'ميزان العمالة المنزلية' },
      { id: 'social_insurance', name: 'ميزان التأمينات' },
      { id: 'passports_residency', name: 'ميزان الوافدين' },
    ],
  },
  {
    id: 'finance',
    title: 'المال والتعاملات',
    icon: 'cash-outline',
    experts: [
      { id: 'banks_sama', name: 'ميزان المصرفي' },
      { id: 'support_daman', name: 'ميزان الدعم' },
      { id: 'claims', name: 'ميزان المطالبات' },
      { id: 'enforcement', name: 'ميزان التنفيذ' },
      { id: 'cheques_commercial_papers', name: 'ميزان الأوراق التجارية' },
      { id: 'default_bankruptcy', name: 'ميزان التعثّر' },
    ],
  },
  {
    id: 'judicial',
    title: 'المساعد العدلي',
    icon: 'business-outline',
    experts: [
      { id: 'judicial_litigation', name: 'ميزان التقاضي' },
      { id: 'judicial_documentation', name: 'ميزان التوثيق' },
      { id: 'judicial_reconciliation', name: 'ميزان الصلح القضائي' },
      { id: 'judicial_objections', name: 'ميزان المهل والاعتراض' },
    ],
  },
  {
    id: 'cyber',
    title: 'مخالفات رقمية',
    icon: 'shield-outline',
    experts: [
      { id: 'financial_fraud', name: 'ميزان الاحتيال الرقمي' },
      { id: 'electronic_extortion', name: 'ميزان الابتزاز' },
      { id: 'identity_hacking', name: 'ميزان الاختراق' },
      { id: 'post_report', name: 'ميزان ما بعد البلاغ' },
    ],
  },
  {
    id: 'emergency',
    title: 'الطوارئ والحوادث',
    icon: 'alert-circle-outline',
    experts: [
      { id: 'traffic_accidents', name: 'ميزان الحوادث' },
      { id: 'traffic_violations', name: 'ميزان المخالفات المرورية' },
      { id: 'emergency_firstaid', name: 'ميزان الطوارئ' },
      { id: 'vehicle_insurance', name: 'ميزان تأمين المركبات' },
    ],
  },
  {
    id: 'development',
    title: 'تطويرك',
    icon: 'trending-up-outline',
    experts: [
      { id: 'career_path', name: 'ميزان المسار المهني' },
      { id: 'professional_certs', name: 'ميزان الشهادات' },
      { id: 'entrepreneurship', name: 'ميزان ريادة الأعمال' },
    ],
  },
];
