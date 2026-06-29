// Calligraphy Game 3: طابِق شكل الحرف
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const PAIRS = [
  { isolated: 'ب', connected: 'ـبـ' },
  { isolated: 'ت', connected: 'ـتـ' },
];

export default function CalligraphyMatchShape({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [matched, setMatched] = useState<number[]>([]);

  const handleMatch = (idx: number) => {
    if (matched.includes(idx)) return;
    setMatched([...matched, idx]);
    if (matched.length + 1 === PAIRS.length) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>طابِق شكل الحرف</Text>
      {PAIRS.map((pair, i) => (
        <TouchableOpacity
          key={i}
          style={[s.row, { backgroundColor: matched.includes(i) ? '#E0E0E0' : color }]}
          onPress={() => handleMatch(i)}
          disabled={matched.includes(i)}
        >
          <Text style={{ fontSize: 36, fontFamily: 'Cairo_900Black' }}>{pair.isolated}</Text>
          <Text style={{ fontSize: 28 }}>→</Text>
          <Text style={{ fontSize: 36, fontFamily: 'Cairo_900Black' }}>{pair.connected}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 16, padding: 16, borderRadius: 12, alignItems: 'center', minWidth: 200 },
});
