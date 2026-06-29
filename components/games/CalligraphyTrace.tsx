// Calligraphy Game 1: تتبّع الحرف
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CalligraphyTrace({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [traced, setTraced] = useState(false);

  const handleTrace = () => {
    setTraced(true);
    setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>تتبّع الحرف</Text>
      <Text style={{ fontSize: 120, fontFamily: 'Cairo_900Black', color: '#DDD' }}>ب</Text>
      <TouchableOpacity
        style={[s.btn, { backgroundColor: traced ? '#999' : color }]}
        onPress={handleTrace}
        disabled={traced}
      >
        <Text style={s.btnText}>{traced ? '✓ تمام!' : 'تتبّعت الحرف'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  btn: { padding: 16, borderRadius: 12, minWidth: 180 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
