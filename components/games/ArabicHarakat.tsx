// Arabic Game 3: اختر الحركة
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const QUESTION = { letter: 'كَ', haraka: 'فتحة' };

export default function ArabicHarakat({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (haraka: string) => {
    setSelected(haraka);
    if (haraka === QUESTION.haraka) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>ما الحركة؟</Text>
      <Text style={{ fontSize: 80, fontFamily: 'Cairo_900Black' }}>{QUESTION.letter}</Text>
      <View style={s.choices}>
        {['فتحة', 'كسرة', 'ضمة'].map((haraka) => (
          <TouchableOpacity
            key={haraka}
            style={[s.choice, { borderColor: color }]}
            onPress={() => handleSelect(haraka)}
          >
            <Text style={{ fontSize: 18, fontFamily: 'Cairo_700Bold' }}>{haraka}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { padding: 14, borderWidth: 2, borderRadius: 12, minWidth: 80, alignItems: 'center' },
});
