// English Game 3: رتّب ABC
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function EnglishSortABC({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [shuffled] = useState(['C', 'A', 'B']);
  const [order, setOrder] = useState<string[]>([]);

  const handlePress = (letter: string) => {
    if (order.includes(letter)) return;
    const newOrder = [...order, letter];
    setOrder(newOrder);
    if (newOrder.join('') === 'ABC') setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Sort ABC</Text>
      <View style={s.order}>
        {order.map((l, i) => (
          <Text key={i} style={{ fontSize: 40, fontWeight: '900' }}>{l}</Text>
        ))}
      </View>
      <View style={s.choices}>
        {shuffled.map((letter) => (
          <TouchableOpacity
            key={letter}
            style={[s.choice, { borderColor: color, opacity: order.includes(letter) ? 0.3 : 1 }]}
            onPress={() => handlePress(letter)}
            disabled={order.includes(letter)}
          >
            <Text style={{ fontSize: 36, fontWeight: '900' }}>{letter}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  order: { flexDirection: 'row', gap: 12 },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { width: 80, height: 80, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
