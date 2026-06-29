// Creative Game 3: أكمل الرسم المتماثل
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CreativeSymmetry({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [completed, setCompleted] = useState(false);

  const handleComplete = () => {
    setCompleted(true);
    setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>أكمل الرسم المتماثل</Text>
      <View style={s.canvas}>
        <View style={[s.half, { backgroundColor: color }]}>
          <Text style={{ fontSize: 60 }}>🦋</Text>
        </View>
        <View style={[s.half, { backgroundColor: completed ? color : '#EEE' }]}>
          {completed && <Text style={{ fontSize: 60 }}>🦋</Text>}
        </View>
      </View>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: completed ? '#999' : color }]}
        onPress={handleComplete}
        disabled={completed}
      >
        <Text style={s.btnText}>{completed ? '✓ تمام!' : 'أكملت الرسم'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  canvas: { flexDirection: 'row', borderWidth: 2, borderRadius: 12, overflow: 'hidden' },
  half: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  btn: { padding: 16, borderRadius: 12, minWidth: 180 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
