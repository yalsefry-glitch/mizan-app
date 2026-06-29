// English Game 2: الحرف الأول
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const WORDS = [{ word: 'APPLE', emoji: '🍎', first: 'A' }];

export default function EnglishFirstLetter({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (letter: string) => {
    setSelected(letter);
    if (letter === WORDS[0].first) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>First Letter</Text>
      <Text style={{ fontSize: 60 }}>{WORDS[0].emoji}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>{WORDS[0].word}</Text>
      <View style={s.choices}>
        {['A', 'B', 'C'].map((letter) => (
          <TouchableOpacity
            key={letter}
            style={[s.choice, { borderColor: color }]}
            onPress={() => handleSelect(letter)}
          >
            <Text style={{ fontSize: 30, fontWeight: '900' }}>{letter}</Text>
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
  choice: { width: 70, height: 70, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
