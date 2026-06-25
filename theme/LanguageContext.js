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
  home_tagline: { ar: 'مساعدك الذكي المتخصّص — ٣٣ مختصّاً في خدمتك', en: 'Your smart specialized assistant — 33 experts at your service' },
  home_search_placeholder: { ar: 'ابحث عن خدمة أو سؤال...', en: 'Search for a service or question...' },
  home_axes: { ar: 'المحاور', en: 'Categories' },
  home_search_results: { ar: 'نتائج البحث', en: 'Search Results' },
  home_no_results: { ar: 'لا نتائج مطابقة. جرّب كلمة أخرى.', en: 'No matches. Try another keyword.' },
  general_assistant: { ar: 'ميزان العام', en: 'Mizan General' },
  general_assistant_sub: { ar: 'نقطة انطلاقك', en: 'Your starting point' },

  // عناوين المحاور
  axis_family: { ar: 'الأسرة والأحوال', en: 'Family & Status' },
  axis_labor: { ar: 'العمل والأفراد', en: 'Work & Individuals' },
  axis_finance: { ar: 'المال والتعاملات', en: 'Money & Transactions' },
  axis_judicial: { ar: 'المساعد العدلي', en: 'Justice Assistant' },
  axis_cyber: { ar: 'مخالفات رقمية', en: 'Digital Offenses' },
  axis_emergency: { ar: 'الطوارئ والحوادث', en: 'Emergencies & Accidents' },
  axis_development: { ar: 'تطويرك', en: 'Your Growth' },

  // الجمل التعريفية للمحاور
  tag_family: { ar: 'أسرتك وأحوالك بثقة', en: 'Your family matters, with confidence' },
  tag_labor: { ar: 'حقوقك ومسارك المهني', en: 'Your rights and career path' },
  tag_finance: { ar: 'تعاملاتك المالية بثقة', en: 'Your finances, with confidence' },
  tag_judicial: { ar: 'طريقك في الإجراءات العدلية', en: 'Your path through legal procedures' },
  tag_cyber: { ar: 'حمايتك في العالم الرقمي', en: 'Your protection in the digital world' },
  tag_emergency: { ar: 'تصرّفك وقت الحاجة', en: 'What to do when it matters' },
  tag_development: { ar: 'نموّك المهني خطوة بخطوة', en: 'Your professional growth, step by step' },

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
  chat_reply_fallback: { ar: 'تعذّر الحصول على ردّ الآن. حاول مرة أخرى.', en: 'Could not get a reply right now. Please try again.' },
  chat_conn_error: { ar: 'حدث خطأ في الاتصال. تحقّق من الإنترنت وحاول مجدداً.', en: 'A connection error occurred. Check your internet and try again.' },
  chat_disclaimer: { ar: 'ميزان مساعد استرشادي للتوعية، والمعلومات قابلة للتغيير، ويُنصح بالرجوع إلى الجهة الرسمية المعنيّة قبل الإجراء.', en: 'Mizan is an awareness guidance assistant. Information may change; please refer to the relevant official authority before taking action.' },

  // عامّة
  start_chat: { ar: 'ابدأ المحادثة', en: 'Start chat' },
  back: { ar: 'العودة', en: 'Back' },
  continue_btn: { ar: 'متابعة', en: 'Continue' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  loading: { ar: 'جارٍ التحميل...', en: 'Loading...' },

  // مربّع تبديل اللغة
  lang_switch_title: { ar: 'تغيير اللغة', en: 'Change language' },
  lang_switch_body: { ar: 'سيُعاد تشغيل التطبيق لتطبيق تغيير اللغة. هل تريد المتابعة؟', en: 'The app will restart to apply the language change. Continue?' },
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
