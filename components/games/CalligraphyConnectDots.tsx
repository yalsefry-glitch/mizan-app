// Calligraphy Game 2: وصّل النقاط
import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function CalligraphyConnectDots({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [connected, setConnected] = useState(0);
  const TOTAL = 3;

  const handleConnect = () => {
    const next = connected + 1;
    setConnected(next);
    if (next === TOTAL) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>وصّل النقاط</Text>
      <Text style={s.progress}>{connected} / {TOTAL}</Text>
      <View style={s.dots}>
        {[1, 2, 3].map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.dot, { backgroundColor: connected >= n ? color : '#DDD' }]}
            onPress={handleConnect}
            disabled={connected >= n}
          >
            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '900' }}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  progress: { fontSize: 22, fontWeight: '900' },
  dots: { flexDirection: 'row', gap: 12 },
  dot: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
