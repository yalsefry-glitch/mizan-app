import { useRef, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { axes } from '../../data/axes';

const toArabic = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const { width: SCREEN_W } = Dimensions.get('window');
const SHIMMER_RANGE = SCREEN_W * 0.55;

function AxisCard({ axis, writingDir }) {
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
      <Pressable onPressIn={onIn} onPressOut={onOut} style={styles.borderWrap}>
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
              size={18}
              color={colors.goldLight}
            />
          </View>
          <Text style={[styles.cardTitle, { writingDirection: writingDir }]}>
            {axis.title}
          </Text>
          <Text style={[styles.cardCount, { writingDirection: writingDir }]}>
            {toArabic(axis.experts.length)} مختصّون
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
  const shimmer = useRef(new Animated.Value(0)).current;

  // اتجاه الكتابة يُقرأ وقت العرض: rtl للعربي، ltr للإنجليزي. المحاذاة تلقائية حسب لغة المحتوى.
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

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_W, SCREEN_W],
  });

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
            <Pressable style={styles.hbtn}>
              <Text style={styles.lng}>AR</Text>
            </Pressable>
            <Pressable style={styles.hbtn}>
              <Ionicons name="notifications-outline" size={21} color={colors.goldLight} />
              <View style={styles.dot} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.tagline, { writingDirection: writingDir }]}>
          مساعدك الذكي المتخصّص — ٣٣ مختصّاً في خدمتك
        </Text>

        <View style={styles.search}>
          <Ionicons name="search" size={19} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن خدمة أو سؤال..."
            placeholderTextColor={colors.muted}
          />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.seclabel}>
          <View style={styles.secbar} />
          <Text style={styles.sectionTitle}>المحاور</Text>
        </View>

        <View style={styles.grid}>
          {axes.map((axis) => (
            <AxisCard key={axis.id} axis={axis} writingDir={writingDir} />
          ))}
        </View>

        <Text style={styles.disclaimer}>
          المعلومات قابلة للتحديث، ويُنصح باستشارة مختصّ قبل الإجراء.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  body: { padding: 18, paddingBottom: 40 },
  seclabel: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 15 },
  secbar: { width: 26, height: 3, borderRadius: 2, backgroundColor: colors.gold },
  sectionTitle: { fontFamily: 'Cairo_700Bold', fontSize: 18, color: colors.emerald },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
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
    minHeight: 104,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  shimmerBand: { position: 'absolute', top: -30, bottom: -30, width: 50 },
  shimmerFill2: { flex: 1 },
  cardEmb: {
    width: 34,
    height: 34,
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
  cardCount: {
    fontFamily: 'Tajawal_700Bold',
    fontSize: 12,
    color: colors.gold,
    marginTop: 7,
  },
  disclaimer: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 11.5,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
});
