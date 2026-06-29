// Math Game 3: الشكل الناقص
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const SHAPES = ['⭕', '🔺', '⬛', '⬜'];

export default function MathShapeMissing({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [pattern] = useState([SHAPES[0], SHAPES[1], SHAPES[0], '?']);
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (shape: string) => {
    setSelected(shape);
    if (shape === SHAPES[0]) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>أكمل النمط</Text>
      <View style={s.pattern}>
        {pattern.map((s, i) => (
          <Text key={i} style={s === '?' ? { fontSize: 40, color: color } : { fontSize: 40 }}>
            {s}
          </Text>
        ))}
      </View>
      <View style={s.choices}>
        {SHAPES.map((shape) => (
          <TouchableOpacity key={shape} style={[s.choice, { borderColor: color }]} onPress={() => handleSelect(shape)}>
            <Text style={{ fontSize: 36 }}>{shape}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  pattern: { flexDirection: 'row', gap: 12 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { width: 60, height: 60, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
