import { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  I18nManager,
  Animated,
  Easing,
  Dimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useTheme } from '../../theme/ThemeContext';
import { useLang } from '../../theme/LanguageContext';
import { axes } from '../../data/axes';
import { supabase } from '../../lib/supabase';

const toArabic = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const { width: SCREEN_W } = Dimensions.get('window');
const SHIMMER_RANGE = SCREEN_W * 0.55;

// جملة تعريفية موحية تحت كل محور (بدل عدّ المختصّين). مفاتيح الترجمة في القاموس.
const AXIS_TAG_KEY = {
  family: 'tag_family',
  labor: 'tag_labor',
  finance: 'tag_finance',
  judicial: 'tag_judicial',
  cyber: 'tag_cyber',
  emergency: 'tag_emergency',
  development: 'tag_development',
};
const AXIS_TITLE_KEY = {
  family: 'axis_family',
  labor: 'axis_labor',
  finance: 'axis_finance',
  judicial: 'axis_judicial',
  cyber: 'axis_cyber',
  emergency: 'axis_emergency',
  development: 'axis_development',
};

// قاموس البحث: كلمات مفتاحية (عربي/إنجليزي/عامّية) تُوجّه لكل محور.
const SEARCH_INDEX = {
  family: ['اسرة', 'أسرة', 'احوال', 'أحوال', 'مدنية', 'زواج', 'طلاق', 'خلع', 'حضانة', 'نفقة', 'رؤية', 'صلح', 'عنف', 'حماية', 'توثيق', 'family', 'marriage', 'divorce', 'custody', 'alimony'],
  labor: ['عمل', 'عقود', 'عقد', 'قوى', 'مدد', 'رواتب', 'راتب', 'شكوى', 'شكاوى', 'عمالة', 'مساند', 'خادمة', 'سائق', 'تأمينات', 'تامينات', 'اجتماعية', 'جوازات', 'اقامة', 'إقامة', 'كفالة', 'نقل', 'وظيفة', 'موظف', 'labor', 'work', 'qiwa', 'mudad', 'gosi', 'insurance', 'jobs', 'residency', 'iqama'],
  finance: ['مال', 'بنك', 'بنوك', 'ساما', 'حساب', 'دعم', 'ضمان', 'مطالبة', 'مطالبات', 'تنفيذ', 'شيك', 'شيكات', 'تجارية', 'تعثر', 'إفلاس', 'افلاس', 'قرض', 'دين', 'ديون', 'تمويل', 'finance', 'bank', 'sama', 'support', 'claim', 'cheque', 'bankruptcy', 'loan', 'debt'],
  judicial: ['عدلي', 'عدل', 'ناجز', 'محكمة', 'محاكم', 'تقاضي', 'دعوى', 'قضية', 'توثيق', 'تصديق', 'وكالة', 'صك', 'اعتراض', 'مهلة', 'استئناف', 'تظلم', 'judicial', 'najiz', 'court', 'lawsuit', 'appeal', 'notary'],
  cyber: ['احتيال', 'نصب', 'ابتزاز', 'اختراق', 'انتحال', 'هكر', 'تهديد', 'بلاغ', 'الكتروني', 'إلكتروني', 'رقمي', 'سيبراني', 'cyber', 'fraud', 'scam', 'extortion', 'hacking', 'phishing'],
  emergency: ['طوارئ', 'حادث', 'حوادث', 'مروري', 'مرور', 'مخالفة', 'مخالفات', 'اسعاف', 'إسعاف', 'نجم', 'ساهر', 'سيارة', 'emergency', 'accident', 'traffic', 'violation', 'ambulance'],
  development: ['تطوير', 'تطويرك', 'مسار', 'مهني', 'ترقية', 'ترقيات', 'شهادة', 'شهادات', 'تاهيل', 'تأهيل', 'احترافية', 'ريادة', 'اعمال', 'أعمال', 'منشأة', 'منشآت', 'مشروع', 'career', 'professional', 'certificate', 'certification', 'entrepreneurship', 'startup', 'business'],
};

function searchAxes(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const matched = [];
  for (const axis of axes) {
    const kws = SEARCH_INDEX[axis.id] || [];
    const hit =
      kws.some((k) => q.includes(k.toLowerCase()) || k.toLowerCase().includes(q)) ||
      axis.title.toLowerCase().includes(q) ||
      axis.experts.some((e) => e.name.toLowerCase().includes(q));
    if (hit) matched.push(axis);
  }
  return matched;
}

function AxisCard({ axis, title, tagline, writingDir, onPress, colors, styles }) {
  const press = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(0)).current;
  const shimmerLoop = useRef(null);

  const startShimmer = () => {
    shimmerX.setValue(0);
    shimmerLoop.current = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    shimmerLoop.current.start();
  };

  const stopShimmer = () => {
    if (shimmerLoop.current) {
      shimmerLoop.current.stop();
      shimmerLoop.current = null;
    }
  };

  const onIn = () => {
    startShimmer();
    Animated.timing(press, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const onOut = () => {
    Animated.timing(press, {
      toValue: 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) stopShimmer();
    });
  };

  const translateY = press.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const borderOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const shimmerOpacity = press.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const shimmerTX = shimmerX.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_RANGE, SHIMMER_RANGE],
  });

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ translateY }, { scale }] }]}>
      <Animated.View style={[styles.cardGlow, { opacity: press }]} pointerEvents="none" />
      <Pressable onPressIn={onIn} onPressOut={onOut} onPress={onPress} style={styles.borderWrap}>
        <Animated.View style={[styles.borderGrad, { opacity: borderOpacity }]} pointerEvents="none">
          <LinearGradient
            colors={[colors.gold, colors.goldLight, colors.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.borderGradFill}
          />
        </Animated.View>
        <View style={styles.cardInner}>
          <View style={styles.cardEmb}>
            <Ionicons
              name={axis.icon || 'ellipse-outline'}
              size={20}
              color={colors.goldLight}
            />
          </View>
          <Text style={[styles.cardTitle, { writingDirection: writingDir }]}>
            {title}
          </Text>
          <Text style={[styles.cardTag, { writingDirection: writingDir }]}>
            {tagline}
          </Text>
          <Animated.View
            style={[
              styles.shimmerBand,
              { opacity: shimmerOpacity, transform: [{ translateX: shimmerTX }, { rotate: '20deg' }] },
            ]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['transparent', 'rgba(227,199,102,0.55)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shimmerFill2}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { t, lang, setLang } = useLang();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shimmer = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');

  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 3800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, [shimmer]);

  // فحص الموافقة على الشروط.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('profiles')
        .select('terms_accepted_at')
        .eq('id', uid)
        .single();
      if (active && data && !data.terms_accepted_at) {
        router.replace('/terms');
      }
    })();
    return () => { active = false; };
  }, []);

  // تبديل اللغة: تأكيد ثنائي اللغة، ثم ضبط الاتجاه وإعادة التشغيل لتطبيق التغيير.
  const toggleLanguage = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    Alert.alert(
      t('lang_switch_title'),
      t('lang_switch_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('continue_btn'),
          onPress: async () => {
            try {
              await setLang(next);
              const shouldBeRTL = next === 'ar';
              I18nManager.allowRTL(true);
              I18nManager.forceRTL(shouldBeRTL);
              await Updates.reloadAsync();
            } catch (e) {
              // في حال تعذّر إعادة التشغيل (بيئة تطوير): النصوص ستتبدّل عند إعادة فتح التطبيق يدويّاً.
            }
          },
        },
      ],
    );
  };

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

  const results = useMemo(() => searchAxes(query), [query]);
  const searching = query.trim().length > 0;
  const shown = searching ? results : axes;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.emerald, colors.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 14 }]}
      >
        <Animated.View
          style={[styles.shimmer, { transform: [{ translateX }] }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', 'rgba(245,228,160,0.30)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerFill}
          />
        </Animated.View>

        <View style={styles.headerTop}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Image
                source={require('../../assets/scale.png')}
                style={styles.scaleImg}
                resizeMode="contain"
              />
            </View>
            <MaskedView maskElement={<Text style={styles.brandName}>ميزان</Text>}>
              <LinearGradient
                colors={['#FFFFFF', '#FBEFC6', colors.goldLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                <Text style={[styles.brandName, { opacity: 0 }]}>ميزان</Text>
              </LinearGradient>
            </MaskedView>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.hbtn} onPress={toggleLanguage}>
              <Text style={styles.lng}>{lang === 'ar' ? 'EN' : 'AR'}</Text>
            </Pressable>
            <Pressable style={styles.hbtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={21} color={colors.goldLight} />
              <View style={styles.dot} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.tagline, { writingDirection: writingDir }]}>
          {t('home_tagline')}
        </Text>

        <View style={styles.search}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home_search_placeholder')}
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
          />
          {searching ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.seclabel}>
          <View style={styles.secbar} />
          <Text style={styles.sectionTitle}>{searching ? t('home_search_results') : t('home_axes')}</Text>
        </View>

        {searching && shown.length === 0 ? (
          <View style={styles.noRes}>
            <Ionicons name="search-outline" size={40} color={colors.muted} />
            <Text style={[styles.noResText, { writingDirection: writingDir }]}>
              {t('home_no_results')}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {!searching ? (
              <AxisCard
                key="orchestrator"
                axis={{ id: 'orchestrator', icon: 'scale-outline' }}
                title={t('general_assistant')}
                tagline={t('general_assistant_sub')}
                writingDir={writingDir}
                onPress={() => router.push({ pathname: '/chat', params: { name: 'ميزان العام' } })}
                colors={colors}
                styles={styles}
              />
            ) : null}
            {shown.map((axis) => (
              <AxisCard
                key={axis.id}
                axis={axis}
                title={t(AXIS_TITLE_KEY[axis.id]) || axis.title}
                tagline={t(AXIS_TAG_KEY[axis.id]) || ''}
                writingDir={writingDir}
                onPress={() => router.push({ pathname: '/experts', params: { axisId: axis.id } })}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  shimmer: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SCREEN_W },
  shimmerFill: { flex: 1 },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(227,199,102,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleImg: { width: 36, height: 36 },
  brandName: {
    fontFamily: 'Cairo_900Black',
    fontSize: 29,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hbtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(227,199,102,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lng: {
    fontFamily: 'Cairo_800ExtraBold',
    fontSize: 12.5,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E11D48',
    borderWidth: 2,
    borderColor: '#0E4A2E',
  },
  tagline: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 16,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 15,
    height: 50,
    paddingHorizontal: 15,
    marginTop: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Tajawal_400Regular',
    fontSize: 14.5,
    color: colors.textDark,
    padding: 0,
  },
  body: { padding: 18, paddingBottom: 18 },
  seclabel: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15 },
  secbar: { width: 26, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  sectionTitle: { fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.emerald },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  noRes: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  noResText: { fontFamily: 'Tajawal_500Medium', fontSize: 14, color: colors.muted, textAlign: 'center' },
  cardWrap: { width: '48%', marginBottom: 13 },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: colors.card,
    boxShadow: '0px 12px 28px 2px rgba(201,162,39,0.50)',
  },
  borderWrap: {
    borderRadius: 18,
    padding: 1.2,
    position: 'relative',
    boxShadow: '0px 4px 12px 0px rgba(10,42,27,0.06)',
  },
  borderGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  borderGradFill: { flex: 1, borderRadius: 18 },
  cardInner: {
    backgroundColor: colors.card,
    borderRadius: 16.8,
    padding: 15,
    height: 140,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  shimmerBand: { position: 'absolute', top: -30, bottom: -30, width: 50 },
  shimmerFill2: { flex: 1 },
  cardEmb: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  cardTitle: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 14.5,
    color: colors.textDark,
    lineHeight: 21,
  },
  cardTag: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 11.5,
    color: colors.gold,
    marginTop: 7,
    lineHeight: 18,
  },
});
