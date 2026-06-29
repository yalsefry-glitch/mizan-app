// Creative Game 1: لوّن بالأرقام
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CreativeColorByNumber({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [colored, setColored] = useState<number[]>([]);
  const TOTAL = 3;

  const handleColor = (n: number) => {
    if (colored.includes(n)) return;
    setColored([...colored, n]);
    if (colored.length + 1 === TOTAL) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>لوّن الأرقام</Text>
      <View style={s.grid}>
        {[1, 2, 3].map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.cell, { backgroundColor: colored.includes(n) ? color : '#FFF', borderColor: color }]}
            onPress={() => handleColor(n)}
            disabled={colored.includes(n)}
          >
            <Text style={{ fontSize: 28, fontWeight: '900', color: colored.includes(n) ? '#FFF' : color }}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: 10 },
  cell: { width: 80, height: 80, borderWidth: 3, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
