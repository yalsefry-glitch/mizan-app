import { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'mizan_language';

// قاموس الترجمة: كل نصوص الواجهة. كل مفتاح له { ar, en }.
export const STRINGS = {
  // التبويبات
  tab_home: { ar: 'الرئيسية', en: 'Home' },
  tab_estimator: { ar: 'المساعد التقديري', en: 'Estimator' },
  tab_subscriptions: { ar: 'الاشتراكات', en: 'Plans' },
  tab_account: { ar: 'حسابي', en: 'Account' },

  // الرئيسية
  home_tagline: { ar: 'دليلك للإجراءات والخدمات، خطوة بخطوة.', en: 'Your guide to procedures, step by step.' },
  home_search_placeholder: { ar: 'ابحث عن خدمة أو سؤال...', en: 'Search for a service or question...' },
  home_axes: { ar: 'المحاور', en: 'Categories' },
  home_search_results: { ar: 'نتائج البحث', en: 'Search Results' },
  home_no_results: { ar: 'لا نتائج مطابقة. جرّب كلمة أخرى.', en: 'No matches. Try another keyword.' },
  general_assistant: { ar: 'ميزان العام', en: 'Mizan General' },
  general_assistant_sub: { ar: 'نقطة انطلاقك', en: 'Your starting point' },

  // عناوين المحاور
  axis_family: { ar: 'الأسرة والأحوال', en: 'Family & Status' },
  axis_labor: { ar: 'العمل والأفراد', en: 'Work & Labor' },
  axis_finance: { ar: 'المال والتعاملات', en: 'Money & Transactions' },
  axis_judicial: { ar: 'المساعد العدلي', en: 'Judicial Assistant' },
  axis_cyber: { ar: 'مخالفات رقمية', en: 'Digital Crimes' },
  axis_emergency: { ar: 'الطوارئ والحوادث', en: 'Emergencies' },
  axis_development: { ar: 'تطويرك', en: 'Your Growth' },

  // الجمل التعريفية للمحاور (مختصرة، متناسقة)
  tag_family: { ar: 'أسرتك وأحوالك بثقة', en: 'Family matters, with confidence' },
  tag_labor: { ar: 'حقوقك ومسارك المهني', en: 'Your rights and career' },
  tag_finance: { ar: 'تعاملاتك المالية بثقة', en: 'Your finances, with confidence' },
  tag_judicial: { ar: 'إجراءاتك العدلية بوضوح', en: 'Judicial steps, made clear' },
  tag_cyber: { ar: 'حمايتك في العالم الرقمي', en: 'Your digital protection' },
  tag_emergency: { ar: 'تصرّفك وقت الحاجة', en: 'What to do when it matters' },
  tag_development: { ar: 'نموّك المهني خطوة بخطوة', en: 'Your growth, step by step' },

  // المحادثة
  chat_subtitle: { ar: 'مساعد استرشادي', en: 'Guidance assistant' },
  chat_input_placeholder: { ar: 'اكتب سؤالك...', en: 'Type your question...' },
  chat_greeting: { ar: 'اطرح سؤالك، كيف أخدمك اليوم؟', en: 'Ask your question — how can I help you today?' },
  chat_gate_title: { ar: 'يلزم تسجيل الدخول', en: 'Sign in required' },
  chat_gate_note: { ar: 'لبدء المحادثة مع مساعدي ميزان، سجّل دخولك أولاً.', en: 'To start chatting with Mizan assistants, please sign in first.' },
  chat_gate_btn: { ar: 'الذهاب لتسجيل الدخول', en: 'Go to sign in' },
  chat_rate_limited: { ar: 'أرسلت الطلبات بسرعة كبيرة. انتظر لحظةً ثم حاول مرة أخرى.', en: 'You are sending requests too quickly. Please wait a moment and try again.' },
  chat_subscribe_msg: { ar: 'لقد استفدت من رسائلك المجانية. للاستمرار والوصول إلى المختصّين، يمكنك الاشتراك.', en: 'You have used your free messages. To continue and reach the specialists, you can subscribe.' },
  chat_routed_msg: { ar: 'سؤالك يخصّ مجالاً متخصّصاً، وأنصح بالتحدّث مع المختصّ المناسب.', en: 'Your question relates to a specialized area. I recommend talking to the right specialist.' },
  chat_route_suggest: { ar: 'المختصّ المقترح:', en: 'Suggested specialist:' },
  chat_show_plans: { ar: 'عرض الباقات', en: 'View plans' },
  chat_copied: { ar: 'تم نسخ النص', en: 'Text copied' },
  chat_typing: { ar: 'يكتب الآن...', en: 'Typing...' },
  chat_go_to: { ar: 'انتقل إلى', en: 'Go to' },
  chat_reply_fallback: { ar: 'تعذّر الحصول على ردّ الآن. حاول مرة أخرى.', en: 'Could not get a reply right now. Please try again.' },
  chat_conn_error: { ar: 'حدث خطأ في الاتصال. تحقّق من الإنترنت وحاول مجدداً.', en: 'A connection error occurred. Check your internet and try again.' },
  chat_disclaimer: { ar: 'ميزان مساعد استرشادي للتوعية، والمعلومات قابلة للتغيير، ويُنصح بالرجوع إلى الجهة الرسمية المعنيّة قبل الإجراء.', en: 'Mizan is an awareness guidance assistant. Information may change; please refer to the relevant official authority before taking action.' },

  // المساعدون (experts)
  experts_title: { ar: "المساعدون", en: "Assistants" },
  experts_choose: { ar: "اختر المختصّ", en: "Choose a specialist" },
  experts_start_chat: { ar: "ابدأ المحادثة", en: "Start chat" },
  experts_not_found: { ar: "تعذّر العثور على هذا المحور.", en: "This category could not be found." },
  experts_back: { ar: "العودة", en: "Back" },

  // الحساب (account)
  acc_my_account: { ar: "حسابي", en: "My Account" },
  acc_signin: { ar: "تسجيل الدخول", en: "Sign In" },
  acc_signup: { ar: "إنشاء حساب", en: "Create Account" },
  acc_active: { ar: "حساب نشط", en: "Active account" },
  acc_appearance: { ar: "المظهر", en: "Appearance" },
  acc_notifications: { ar: "الإشعارات", en: "Notifications" },
  acc_bio_lock: { ar: "قفل بالبصمة", en: "Fingerprint lock" },
  acc_terms_privacy: { ar: "الشروط والخصوصية", en: "Terms & Privacy" },
  acc_signout: { ar: "تسجيل الخروج", en: "Sign Out" },
  acc_delete: { ar: "حذف الحساب", en: "Delete Account" },
  acc_name_ph: { ar: "الاسم", en: "Name" },
  acc_email_ph: { ar: "البريد الإلكتروني", en: "Email" },
  acc_password_ph: { ar: "كلمة المرور", en: "Password" },
  acc_forgot: { ar: "نسيت كلمة المرور؟", en: "Forgot password?" },
  acc_btn_signin: { ar: "دخول", en: "Sign in" },
  acc_btn_signup: { ar: "إنشاء الحساب", en: "Create account" },
  acc_or: { ar: "أو", en: "or" },
  acc_google: { ar: "المتابعة عبر Google", en: "Continue with Google" },
  acc_to_signup: { ar: "ليس لديك حساب؟ إنشاء حساب", en: "No account? Create one" },
  acc_to_signin: { ar: "لديك حساب؟ تسجيل الدخول", en: "Have an account? Sign in" },
  acc_alert_notice: { ar: "تنبيه", en: "Notice" },
  acc_need_credentials: { ar: "يرجى إدخال البريد وكلمة المرور.", en: "Please enter your email and password." },
  acc_need_name: { ar: "يرجى إدخال اسمك.", en: "Please enter your name." },
  acc_security_check: { ar: "تأكيد الأمان", en: "Security check" },
  acc_wait_captcha: { ar: "يرجى الانتظار حتى يكتمل التحقّق الأمني ثم حاول مجدداً.", en: "Please wait for the security check to finish, then try again." },
  acc_signin_failed: { ar: "تعذّر الدخول", en: "Sign in failed" },
  acc_signup_failed: { ar: "تعذّر إنشاء الحساب", en: "Sign up failed" },
  acc_check_email: { ar: "تحقّق من بريدك", en: "Check your email" },
  acc_verify_sent: { ar: "أُرسل رابط التفعيل إلى بريدك الإلكتروني.", en: "An activation link was sent to your email." },
  acc_forgot_title: { ar: "نسيت كلمة المرور", en: "Forgot password" },
  acc_forgot_hint: { ar: "اكتب بريدك الإلكتروني أولاً، ثم اضغط نسيت كلمة المرور.", en: "Enter your email first, then tap Forgot password." },
  acc_send_failed: { ar: "تعذّر الإرسال", en: "Sending failed" },
  acc_reset_sent: { ar: "أُرسل رابط استعادة كلمة المرور إلى بريدك.", en: "A password reset link was sent to your email." },
  acc_bio_unavailable: { ar: "غير متاح", en: "Unavailable" },
  acc_bio_no_hw: { ar: "جهازك لا يدعم البصمة أو لا توجد بصمة مسجّلة في إعدادات الجهاز.", en: "Your device does not support fingerprint, or none is enrolled in device settings." },
  acc_bio_confirm: { ar: "أكّد بصمتك لتفعيل القفل", en: "Confirm your fingerprint to enable lock" },
  acc_soon: { ar: "قريباً", en: "Coming soon" },
  acc_google_soon: { ar: "الدخول عبر Google سيُفعّل قريباً.", en: "Google sign-in will be enabled soon." },
  acc_del_title: { ar: "حذف الحساب", en: "Delete account" },
  acc_del_warn: { ar: "سيُحذف حسابك وكل بياناتك نهائيّاً، ولا يمكن التراجع. هل تريد المتابعة؟", en: "Your account and all data will be permanently deleted. This cannot be undone. Continue?" },
  acc_del_final_title: { ar: "تأكيد نهائي", en: "Final confirmation" },
  acc_del_final: { ar: "هذا إجراء نهائي لا رجعة فيه. أتأكّد حذف الحساب؟", en: "This is final and irreversible. Confirm account deletion?" },
  acc_del_final_btn: { ar: "حذف نهائيّاً", en: "Delete permanently" },
  acc_del_failed: { ar: "تعذّر الحذف", en: "Deletion failed" },
  acc_del_session_end: { ar: "انتهت الجلسة. سجّل دخولك ثم حاول مجدداً.", en: "Session expired. Sign in and try again." },
  acc_del_error: { ar: "حدث خطأ أثناء حذف الحساب. حاول لاحقاً.", en: "An error occurred while deleting the account. Try later." },
  acc_del_conn: { ar: "تحقّق من الاتصال وحاول مجدداً.", en: "Check your connection and try again." },
  acc_del_done_title: { ar: "تم الحذف", en: "Deleted" },
  acc_del_done: { ar: "تم حذف حسابك وبياناتك بالكامل.", en: "Your account and data have been fully deleted." },

  // الاشتراكات (subscriptions)
  subs_title: { ar: "الاشتراكات", en: "Plans" },
  subs_subtitle: { ar: "اختر ما يناسبك للوصول إلى المختصّين", en: "Choose what suits you to reach the specialists" },
  subs_most_complete: { ar: "الأكثر تكاملاً", en: "Most complete" },
  subs_free: { ar: "مجّاناً", en: "Free" },
  subs_currency: { ar: "ريال", en: "SAR" },
  subs_current_plan: { ar: "باقتك الحالية", en: "Your current plan" },
  subs_subscribe_now: { ar: "اشترك الآن", en: "Subscribe now" },
  subs_load_error: { ar: "تعذّر تحميل الباقات. تحقّق من الاتصال وحاول لاحقاً.", en: "Could not load plans. Check your connection and try later." },
  subs_note: { ar: "المحادثة جلسة كاملة قد تتضمّن عدّة رسائل. الأسعار قابلة للتحديث.", en: "A conversation is a full session that may include several messages. Prices may change." },

  // الإشعارات (notifications)
  notif_title: { ar: "الإشعارات", en: "Notifications" },
  notif_signin: { ar: "سجّل دخولك لعرض إشعاراتك.", en: "Sign in to view your notifications." },
  notif_empty: { ar: "لا إشعارات حتى الآن.", en: "No notifications yet." },

  // شاشة القفل (البصمة)
  lock_welcome: { ar: "أهلاً بك في ميزان", en: "Welcome to Mizan" },
  lock_open_btn: { ar: "فتح بالبصمة", en: "Unlock with fingerprint" },
  lock_prompt: { ar: "افتح ميزان باستخدام بصمتك", en: "Unlock Mizan with your fingerprint" },

  // عامّة
  start_chat: { ar: 'ابدأ المحادثة', en: 'Start chat' },
  back: { ar: 'العودة', en: 'Back' },
  continue_btn: { ar: 'متابعة', en: 'Continue' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  loading: { ar: 'جارٍ التحميل...', en: 'Loading...' },

  // مربّع تبديل اللغة (صياغة أوضح بهوية ميزان)
  lang_switch_title: { ar: 'تغيير لغة ميزان', en: 'Change Mizan language' },
  lang_switch_body: { ar: 'لتطبيق اللغة الجديدة، سيُعيد ميزان تشغيل نفسه تلقائيّاً. كل بياناتك محفوظة.', en: 'To apply the new language, Mizan will restart automatically. All your data is saved.' },
};

// دالّة الترجمة: تُرجع نصّ المفتاح باللغة الحالية.
export function tr(key, lang) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] ?? entry.ar ?? key;
}

const LanguageContext = createContext({
  lang: 'ar',
  isRTL: true,
  t: (k) => k,
  setLang: () => {},
  ready: false,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('ar');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (!active) return;
      if (v === 'ar' || v === 'en') setLangState(v);
      setReady(true);
    }).catch(() => setReady(true));
    return () => { active = false; };
  }, []);

  // تخزين اللغة فقط (إعادة التشغيل وضبط RTL يتمّان من الزرّ بعد تأكيد المستخدم).
  const setLang = (next) => {
    if (next !== 'ar' && next !== 'en') return;
    setLangState(next);
    return AsyncStorage.setItem(LANG_KEY, next);
  };

  const value = {
    lang,
    isRTL: lang === 'ar',
    t: (key) => tr(key, lang),
    setLang,
    ready,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}
