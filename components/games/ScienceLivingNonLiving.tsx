// Science Game 3: حيّ أم غير حيّ
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const ITEMS = [
  { emoji: '🌳', living: true },
  { emoji: '🪨', living: false },
  { emoji: '🐕', living: true },
];

export default function ScienceLivingNonLiving({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [current, setCurrent] = useState(0);
  const [correct, setCorrect] = useState(0);

  const handleAnswer = (isLiving: boolean) => {
    if (ITEMS[current].living === isLiving) setCorrect(correct + 1);
    if (current + 1 === ITEMS.length) {
      setTimeout(onComplete, 500);
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>حيّ أم غير حيّ؟</Text>
      <Text style={{ fontSize: 80 }}>{ITEMS[current].emoji}</Text>
      <View style={s.btns}>
        <TouchableOpacity style={[s.btn, { backgroundColor: color }]} onPress={() => handleAnswer(true)}>
          <Text style={s.btnText}>حيّ 🌱</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, { backgroundColor: '#999' }]} onPress={() => handleAnswer(false)}>
          <Text style={s.btnText}>غير حيّ 🪨</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  btns: { flexDirection: 'row', gap: 12 },
  btn: { padding: 16, borderRadius: 12, minWidth: 120 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
