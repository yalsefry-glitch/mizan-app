// Creative Game 2: طابِق اللون باسمه
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const COLORS = [
  { name: 'أحمر', color: '#EF4444' },
  { name: 'أزرق', color: '#3B82F6' },
];

export default function CreativeMatchColor({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [matched, setMatched] = useState<number[]>([]);

  const handleMatch = (idx: number) => {
    if (matched.includes(idx)) return;
    setMatched([...matched, idx]);
    if (matched.length + 1 === COLORS.length) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>طابِق اللون باسمه</Text>
      {COLORS.map((c, i) => (
        <TouchableOpacity
          key={i}
          style={[s.row, { opacity: matched.includes(i) ? 0.4 : 1 }]}
          onPress={() => handleMatch(i)}
          disabled={matched.includes(i)}
        >
          <View style={[s.colorBox, { backgroundColor: c.color }]} />
          <Text style={{ fontSize: 22, fontFamily: 'Cairo_700Bold' }}>{c.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 16, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#DDD' },
  colorBox: { width: 50, height: 50, borderRadius: 8 },
});
