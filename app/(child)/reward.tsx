// app/(child)/reward.tsx
// شاشة المكافأة: 3 ألعاب تعليمية حسب المادّة، منح الجواهر عند الانتهاء

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Hakeem from '../../components/Hakeem';
import MathStarCollect from '../../components/games/MathStarCollect';
import MathCountUp from '../../components/games/MathCountUp';
import MathShapeMissing from '../../components/games/MathShapeMissing';
import ScienceLifeCycle from '../../components/games/ScienceLifeCycle';
import ScienceAnimalHabitat from '../../components/games/ScienceAnimalHabitat';
import ScienceLivingNonLiving from '../../components/games/ScienceLivingNonLiving';
import EnglishWordPicture from '../../components/games/EnglishWordPicture';
import EnglishFirstLetter from '../../components/games/EnglishFirstLetter';
import EnglishSortABC from '../../components/games/EnglishSortABC';
import ArabicBuildWord from '../../components/games/ArabicBuildWord';
import ArabicLetterPicture from '../../components/games/ArabicLetterPicture';
import ArabicHarakat from '../../components/games/ArabicHarakat';
import CalligraphyTrace from '../../components/games/CalligraphyTrace';
import CalligraphyConnectDots from '../../components/games/CalligraphyConnectDots';
import CalligraphyMatchShape from '../../components/games/CalligraphyMatchShape';
import CreativeColorByNumber from '../../components/games/CreativeColorByNumber';
import CreativeMatchColor from '../../components/games/CreativeMatchColor';
import CreativeSymmetry from '../../components/games/CreativeSymmetry';
import { awardGems } from '../../core/economy';
import { recordActivity } from '../../core/streaks';
import { theme } from '../../config/theme';

type Phase = 'select' | 'play' | 'done';
type GameKey = 'math1' | 'math2' | 'math3' | 'science1' | 'science2' | 'science3' | 'english1' | 'english2' | 'english3' | 'arabic1' | 'arabic2' | 'arabic3' | 'calligraphy1' | 'calligraphy2' | 'calligraphy3' | 'creative1' | 'creative2' | 'creative3';

interface GameMeta { id: GameKey; title: string; emoji: string }

function getGamesForSubject(subject: string): GameMeta[] {
  const games: Record<string, GameMeta[]> = {
    math: [
      { id: 'math1', title: 'جمع النجوم', emoji: '⭐' },
      { id: 'math2', title: 'العدّ التصاعدي', emoji: '🔢' },
      { id: 'math3', title: 'الشكل الناقص', emoji: '🧩' },
    ],
    science: [
      { id: 'science1', title: 'دورة الحياة', emoji: '🦋' },
      { id: 'science2', title: 'البيئات', emoji: '🌍' },
      { id: 'science3', title: 'حيّ أم لا', emoji: '🌱' },
    ],
    english: [
      { id: 'english1', title: 'Word & Picture', emoji: '🔤' },
      { id: 'english2', title: 'First Letter', emoji: '🅰️' },
      { id: 'english3', title: 'Sort ABC', emoji: '🔡' },
    ],
    arabic: [
      { id: 'arabic1', title: 'كوّن الكلمة', emoji: '✍️' },
      { id: 'arabic2', title: 'الحرف والصورة', emoji: '🎨' },
      { id: 'arabic3', title: 'الحركات', emoji: 'َ◌' },
    ],
    calligraphy: [
      { id: 'calligraphy1', title: 'تتبّع', emoji: '✏️' },
      { id: 'calligraphy2', title: 'وصّل النقاط', emoji: '🔗' },
      { id: 'calligraphy3', title: 'الأشكال', emoji: '📝' },
    ],
    creative: [
      { id: 'creative1', title: 'لوّن بالأرقام', emoji: '🎨' },
      { id: 'creative2', title: 'الألوان', emoji: '🌈' },
      { id: 'creative3', title: 'التماثل', emoji: '🦋' },
    ],
  };
  return games[subject] || games.math;
}

export default function RewardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { childId, subject } = useLocalSearchParams<{ childId: string; subject?: string }>();

  const [phase, setPhase] = useState<Phase>('select');
  const [selectedGame, setSelectedGame] = useState<GameKey | null>(null);
  const [gemsEarned, setGemsEarned] = useState(0);

  const games = getGamesForSubject(subject || 'math');
  const color = theme.colors.primary;

  useEffect(() => {
    if (childId) recordActivity(childId).catch(() => {});
  }, [childId]);

  const handleGameComplete = async () => {
    const gems = 5;
    setGemsEarned(gems);
    setPhase('done');
    if (childId) {
      try {
        await awardGems(childId, gems, 'لعبة المكافأة');
      } catch {}
    }
  };

  const handlePlayAgain = () => {
    setPhase('select');
    setSelectedGame(null);
    setGemsEarned(0);
  };

  const renderGame = () => {
    if (!selectedGame) return null;
    const props = { onComplete: handleGameComplete, color };

    switch (selectedGame) {
      case 'math1': return <MathStarCollect targetCount={5} {...props} />;
      case 'math2': return <MathCountUp maxNumber={5} {...props} />;
      case 'math3': return <MathShapeMissing {...props} />;
      case 'science1': return <ScienceLifeCycle {...props} />;
      case 'science2': return <ScienceAnimalHabitat {...props} />;
      case 'science3': return <ScienceLivingNonLiving {...props} />;
      case 'english1': return <EnglishWordPicture {...props} />;
      case 'english2': return <EnglishFirstLetter {...props} />;
      case 'english3': return <EnglishSortABC {...props} />;
      case 'arabic1': return <ArabicBuildWord {...props} />;
      case 'arabic2': return <ArabicLetterPicture {...props} />;
      case 'arabic3': return <ArabicHarakat {...props} />;
      case 'calligraphy1': return <CalligraphyTrace {...props} />;
      case 'calligraphy2': return <CalligraphyConnectDots {...props} />;
      case 'calligraphy3': return <CalligraphyMatchShape {...props} />;
      case 'creative1': return <CreativeColorByNumber {...props} />;
      case 'creative2': return <CreativeMatchColor {...props} />;
      case 'creative3': return <CreativeSymmetry {...props} />;
      default: return null;
    }
  };

  if (phase === 'done') {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <Hakeem mood="happy" size={140} />
        <Text style={s.congrats}>🎉 ممتاز يا بطل!</Text>
        <Text style={s.gems}>كسبت {gemsEarned} جواهر 💎</Text>
        <TouchableOpacity style={[s.btn, { backgroundColor: color }]} onPress={handlePlayAgain}>
          <Text style={s.btnText}>العب مرة أخرى</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnSecondary} onPress={() => router.back()}>
          <Text style={s.btnSecondaryText}>ارجع للعالم</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'play' && selectedGame) {
    return (
      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.playContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
      >
        {renderGame()}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.selectContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={s.title}>اختر لعبتك 🎮</Text>
      {games.map((game) => (
        <TouchableOpacity
          key={game.id}
          style={[s.gameCard, { borderColor: color }]}
          onPress={() => {
            setSelectedGame(game.id);
            setPhase('play');
          }}
        >
          <Text style={{ fontSize: 50 }}>{game.emoji}</Text>
          <Text style={s.gameTitle}>{game.title}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, backgroundColor: theme.colors.background },
  selectContainer: { alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  playContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  title: { fontSize: 24, fontFamily: theme.fonts.heading, color: theme.colors.textDark },
  gameCard: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    borderWidth: 3,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    gap: 8,
  },
  gameTitle: { fontSize: 18, fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark },
  congrats: { fontSize: 26, fontFamily: theme.fonts.heading, color: theme.colors.textDark },
  gems: { fontSize: 22, fontFamily: theme.fonts.bodyBold, color: theme.colors.gem },
  btn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 12 },
  btnText: { fontSize: 18, fontFamily: theme.fonts.bodyBold, color: '#FFF' },
  btnSecondary: { paddingHorizontal: 40, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.border },
  btnSecondaryText: { fontSize: 16, fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark },
});
