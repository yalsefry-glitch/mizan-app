// Arabic Game 1: كوّن الكلمة
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const TARGET = ['ق', 'ط', 'ة'];

export default function ArabicBuildWord({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [shuffled] = useState([...TARGET].sort(() => Math.random() - 0.5));
  const [built, setBuilt] = useState<string[]>([]);

  const handlePress = (letter: string) => {
    if (built.includes(letter)) return;
    const newBuilt = [...built, letter];
    setBuilt(newBuilt);
    if (newBuilt.join('') === TARGET.join('')) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>كوّن الكلمة: قطة</Text>
      <View style={s.built}>
        {built.map((l, i) => (
          <Text key={i} style={{ fontSize: 40, fontFamily: 'Cairo_700Bold' }}>{l}</Text>
        ))}
      </View>
      <View style={s.choices}>
        {shuffled.map((letter) => (
          <TouchableOpacity
            key={letter}
            style={[s.choice, { borderColor: color, opacity: built.includes(letter) ? 0.3 : 1 }]}
            onPress={() => handlePress(letter)}
            disabled={built.includes(letter)}
          >
            <Text style={{ fontSize: 36, fontFamily: 'Cairo_700Bold' }}>{letter}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  built: { flexDirection: 'row', gap: 8 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { width: 80, height: 80, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
