// Science Game 1: رتّب دورة الحياة
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const STAGES = ['🥚', '🐛', '🦋'];

export default function ScienceLifeCycle({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [shuffled] = useState([...STAGES].sort(() => Math.random() - 0.5));
  const [order, setOrder] = useState<string[]>([]);

  const handlePress = (stage: string) => {
    if (order.includes(stage)) return;
    const newOrder = [...order, stage];
    setOrder(newOrder);
    if (newOrder.length === 3 && newOrder.join('') === STAGES.join('')) {
      setTimeout(onComplete, 500);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>رتّب دورة حياة الفراشة</Text>
      <View style={s.order}>
        {order.map((s, i) => (
          <Text key={i} style={{ fontSize: 50 }}>{s}</Text>
        ))}
      </View>
      <View style={s.choices}>
        {shuffled.map((stage) => (
          <TouchableOpacity
            key={stage}
            style={[s.choice, { borderColor: color, opacity: order.includes(stage) ? 0.3 : 1 }]}
            onPress={() => handlePress(stage)}
            disabled={order.includes(stage)}
          >
            <Text style={{ fontSize: 45 }}>{stage}</Text>
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
