// Math Game 2: العدّ التصاعدي
// الطفل يضغط الأرقام بالترتيب

import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MathCountUpProps {
  maxNumber: number;
  onComplete: () => void;
  color: string;
}

export default function MathCountUp({ maxNumber, onComplete, color }: MathCountUpProps) {
  const [current, setCurrent] = useState(1);
  const numbers = Array.from({ length: maxNumber }, (_, i) => i + 1).sort(() => Math.random() - 0.5);

  const handlePress = (num: number) => {
    if (num === current) {
      const next = current + 1;
      setCurrent(next);
      if (next > maxNumber) setTimeout(onComplete, 500);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>اضغط الأرقام بالترتيب</Text>
      <Text style={s.current}>الرقم التالي: {current}</Text>
      <View style={s.grid}>
        {numbers.map((num) => (
          <TouchableOpacity
            key={num}
            style={[s.btn, { backgroundColor: num < current ? '#E0E0E0' : color }]}
            onPress={() => handlePress(num)}
            disabled={num < current}
          >
            <Text style={[s.numText, { color: num < current ? '#999' : '#FFF' }]}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  current: { fontSize: 20, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 320 },
  btn: { width: 70, height: 70, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 28, fontWeight: '900' },
});
