import { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  I18nManager,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../theme/colors';
import { axes } from '../data/axes';

const toArabic = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const { width: SCREEN_W } = Dimensions.get('window');
const SHIMMER_RANGE = SCREEN_W * 0.55;

function ExpertCard({ expert, axisIcon, writingDir, onPress }) {
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
            <Ionicons name={axisIcon || 'ellipse-outline'} size={20} color={colors.goldLight} />
          </View>
          <Text style={[styles.cardTitle, { writingDirection: writingDir }]}>{expert.name}</Text>
          <View style={styles.cardCta}>
            <Text style={[styles.cardCtaText, { writingDirection: writingDir }]}>ابدأ المحادثة</Text>
            <Ionicons name="arrow-back" size={14} color={colors.gold} />
          </View>
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
              style={styles.shimmerFill}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ExpertsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const axisId = params.axisId ? String(params.axisId) : '';

  const writingDir = I18nManager.isRTL ? 'rtl' : 'ltr';
  const axis = axes.find((a) => a.id === axisId) ?? null;

  const goToChat = (expert) => {
    router.push({ pathname: '/chat', params: { assistantId: expert.id, name: expert.name } });
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[colors.emerald, colors.emeraldDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={22} color={colors.goldLight} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { writingDirection: writingDir }]}>
              {axis ? axis.title : 'المساعدون'}
            </Text>
            <Text style={[styles.headerSub, { writingDirection: writingDir }]}>
              {axis ? `${toArabic(axis.experts.length)} مختصّون` : ''}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {axis ? (
          <>
            <View style={styles.seclabel}>
              <View style={styles.secbar} />
              <Text style={styles.sectionTitle}>اختر المختصّ</Text>
            </View>

            <View style={styles.grid}>
              {axis.experts.map((expert) => (
                <ExpertCard
                  key={expert.id}
                  expert={expert}
                  axisIcon={axis.icon}
                  writingDir={writingDir}
                  onPress={() => goToChat(expert)}
                />
              ))}
            </View>

            <Text style={styles.disclaimer}>
              المعلومات قابلة للتحديث, ويُنصح باستشارة مختصّ قبل الإجراء.
            </Text>
          </>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={44} color={colors.muted} />
            <Text style={[styles.emptyText, { writingDirection: writingDir }]}>
              تعذّر العثور على هذا المحور.
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.back()}>
              <Text style={styles.emptyBtnText}>العودة</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
  headerTitle: { fontFamily: 'Cairo_700Bold', fontSize: 20, color: '#FFFFFF' },
  headerSub: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
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
  borderGrad: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 18 },
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
  shimmerFill: { flex: 1 },
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
  cardCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  cardCtaText: { fontFamily: 'Tajawal_700Bold', fontSize: 12, color: colors.gold },
  disclaimer: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 11.5,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 12,
  },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyText: { fontFamily: 'Tajawal_500Medium', fontSize: 15, color: colors.muted },
  emptyBtn: {
    backgroundColor: colors.emerald,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 6,
  },
  emptyBtnText: { fontFamily: 'Cairo_700Bold', fontSize: 14, color: '#FFFFFF' },
});
