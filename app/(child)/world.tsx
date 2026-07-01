// app/(child)/world.tsx
// شاشة «عالمي» — قلب تجربة الطفل العاطفية:
// - الكوكب الحيّ (Skia) يعكس طقس السلسلة.
// - شعلة السلسلة اليومية.
// - التحدّي العائلي المشترك (شريط تقدّم + إسهام الإخوة).
// - متجر الجواهر (حيوانات + مقتنيات كوكب) بأصول فنية عبر expo-image.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AssetImage from '../../components/AssetImage';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import PlanetCanvas from '../../components/PlanetCanvas';
import { getStreak, type Weather } from '../../core/streaks';
import { getGemBalance, getPetsCatalog, getWorldCatalog, buyPet, buyWorldItem } from '../../core/economy';
import { getFamilyChallenge, type ChallengeView } from '../../core/challenge';
import type { PetCatalogItem, WorldCatalogItem } from '../../core/supabase';
import { theme } from '../../config/theme';

export default function WorldScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();

  const [loading, setLoading] = useState(true);
  const [gems, setGems] = useState(0);
  const [weather, setWeather] = useState<Weather>('thriving');
  const [streakDays, setStreakDays] = useState(0);
  const [pets, setPets] = useState<PetCatalogItem[]>([]);
  const [worldItems, setWorldItems] = useState<WorldCatalogItem[]>([]);
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);

  const load = useCallback(async () => {
    if (!childId) return;
    setLoading(true);
    try {
      const [balance, streak, petsCat, worldCat, fam] = await Promise.all([
        getGemBalance(childId),
        getStreak(childId),
        getPetsCatalog(),
        getWorldCatalog(),
        getFamilyChallenge(childId),
      ]);
      setGems(balance);
      setWeather(streak.weather);
      setStreakDays(streak.current);
      setPets(petsCat);
      setWorldItems(worldCat);
      setChallenge(fam);
    } catch (error) {
      console.error('[عالمي] تحميل:', error);
      // حالة آمنة افتراضية عند الفشل
      setGems(0);
      setWeather('cloudy');
      setStreakDays(0);
      setPets([]);
      setWorldItems([]);
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleBuyPet = async (pet: PetCatalogItem) => {
    if (!childId) return;
    const res = await buyPet(childId, pet);
    if (res.ok && res.newBalance !== undefined) setGems(res.newBalance);
  };

  const handleBuyItem = async (item: WorldCatalogItem) => {
    if (!childId) return;
    const res = await buyWorldItem(childId, item);
    if (res.ok && res.newBalance !== undefined) setGems(res.newBalance);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const challengeProgress = challenge?.progress ?? 0;

  return (
    <ScrollView style={s.flex} contentContainerStyle={s.container}>
      {/* الهيدر: الجواهر */}
      <View style={s.header}>
        <Text style={s.title}>عالمي</Text>
        <View style={s.gemPill}>
          <Text style={s.gemText}>💎 {gems}</Text>
        </View>
      </View>

      {/* الشعلة */}
      <View style={s.streakBar}>
        <Text style={s.streakFlame}>🔥</Text>
        <Text style={s.streakText}>
          {weather === 'thriving'
            ? `سلسلة ${streakDays} ${streakDays === 1 ? 'يوم' : 'أيام'}! لا تكسرها`
            : 'عُد اليوم لتُشرق شمس كوكبك من جديد'}
        </Text>
      </View>

      {/* الكوكب الحيّ */}
      <View style={s.planetSection}>
        <PlanetCanvas weather={weather} size={220} />
        <Text style={s.planetStatus}>
          {weather === 'thriving' ? 'كوكبك مزدهر ومشرق' : 'كوكبك غائم... تعلّم لتُشرقه'}
        </Text>
      </View>

      {/* التحدّي العائلي */}
      {challenge?.challenge && (
        <View style={s.challengeCard}>
          <Text style={s.challengeTitle}>التحدّي العائلي</Text>
          <Text style={s.challengeGoal}>{challenge.challenge.title}</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${challengeProgress * 100}%` }]} />
          </View>
          <Text style={s.challengeCount}>
            {challenge.challenge.current_total} / {challenge.challenge.goal} 💎
          </Text>
          <View style={s.contributorsRow}>
            {challenge.contributors.map((c) => (
              <View key={c.childId} style={s.contributor}>
                <View style={s.contributorAvatar}>
                  <Text style={s.contributorLetter}>{c.name.charAt(0)}</Text>
                </View>
                <Text style={s.contributorName}>{c.name}</Text>
                <Text style={s.contributorGems}>{c.contribution}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* متجر الحيوانات */}
      <Text style={s.sectionTitle}>حيوانات كوكبك</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.shopRow}>
        {pets.map((pet) => (
          <TouchableOpacity key={pet.id} style={s.shopItem} onPress={() => handleBuyPet(pet)}>
            <AssetImage assetUrl={pet.asset_url} size={44} />
            <Text style={s.shopName}>{pet.name}</Text>
            <Text style={s.shopPrice}>💎 {pet.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* متجر المقتنيات */}
      <Text style={s.sectionTitle}>طوّر كوكبك</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.shopRow}>
        {worldItems.map((item) => (
          <TouchableOpacity key={item.id} style={s.shopItem} onPress={() => handleBuyItem(item)}>
            <AssetImage assetUrl={item.asset_url} size={44} />
            <Text style={s.shopName}>{item.name}</Text>
            <Text style={s.shopPrice}>💎 {item.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* زرّ التعلّم */}
      <TouchableOpacity
        style={s.learnBtn}
        onPress={() => router.push({ pathname: '/(child)/journey', params: { childId } })}
      >
        <Text style={s.learnBtnText}>ابدأ رحلة التعلّم واكسب الجواهر</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.md, paddingTop: 54, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.textDark },
  gemPill: { backgroundColor: theme.colors.gem, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 7 },
  gemText: { fontFamily: theme.fonts.headingMed, fontSize: 15, color: theme.colors.white },
  streakBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: theme.radius.md, padding: 12, marginBottom: 16 },
  streakFlame: { fontSize: 22 },
  streakText: { flex: 1, fontFamily: theme.fonts.bodyBold, fontSize: 13, color: '#D97706' },
  planetSection: { alignItems: 'center', marginBottom: 18 },
  planetStatus: { fontFamily: theme.fonts.headingMed, fontSize: 14, color: theme.colors.textDark, marginTop: 6 },
  challengeCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: theme.spacing.md, marginBottom: 18 },
  challengeTitle: { fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.textDark },
  challengeGoal: { fontFamily: theme.fonts.bodyMed, fontSize: 12, color: theme.colors.textMuted, marginTop: 4, marginBottom: 10 },
  progressTrack: { height: 14, borderRadius: 7, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 7 },
  challengeCount: { fontFamily: theme.fonts.headingMed, fontSize: 13, color: theme.colors.textDark, textAlign: 'center', marginTop: 8 },
  contributorsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  contributor: { alignItems: 'center' },
  contributorAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  contributorLetter: { fontFamily: theme.fonts.headingMed, fontSize: 15, color: theme.colors.white },
  contributorName: { fontFamily: theme.fonts.bodyMed, fontSize: 11, color: theme.colors.textBody },
  contributorGems: { fontFamily: theme.fonts.bodyBold, fontSize: 11, color: theme.colors.primaryDark },
  sectionTitle: { fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.textDark, marginBottom: 10, marginTop: 4 },
  shopRow: { marginBottom: 16 },
  shopItem: { width: 96, backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', marginLeft: 10 },
  shopImage: { width: 44, height: 44, marginBottom: 6 },
  shopName: { fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.textBody, marginBottom: 2 },
  shopPrice: { fontFamily: theme.fonts.bodyBold, fontSize: 12, color: theme.colors.gem },
  learnBtn: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 16, alignItems: 'center', marginTop: 6 },
  learnBtnText: { fontFamily: theme.fonts.headingMed, fontSize: 16, color: theme.colors.white },
});
