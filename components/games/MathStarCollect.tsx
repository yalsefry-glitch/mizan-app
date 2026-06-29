// Math Game 1: جمع النجوم (Star Collect)
// الطفل يلمس النجوم لجمع عدد معيّن

import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Canvas, Circle, Group, useFont } from '@shopify/react-native-skia';

interface StarCollectProps {
  targetCount: number;
  onComplete: () => void;
  color: string;
}

export default function MathStarCollect({ targetCount, onComplete, color }: StarCollectProps) {
  const [collected, setCollected] = useState(0);
  const [stars, setStars] = useState(
    Array.from({ length: targetCount + 3 }, (_, i) => ({
      id: i,
      x: Math.random() * 280 + 20,
      y: Math.random() * 280 + 20,
      visible: true,
    }))
  );

  const handlePress = (id: number) => {
    if (collected >= targetCount) return;
    setStars((prev) => prev.map((s) => (s.id === id ? { ...s, visible: false } : s)));
    const newCount = collected + 1;
    setCollected(newCount);
    if (newCount === targetCount) {
      setTimeout(onComplete, 500);
    }
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>اجمع {targetCount} نجوم ⭐</Text>
      <Text style={s.count}>{collected} / {targetCount}</Text>
      <Canvas style={s.canvas}>
        <Group>
          {stars.map(
            (star) =>
              star.visible && (
                <Circle key={star.id} cx={star.x} cy={star.y} r={18} color={color} />
              )
          )}
        </Group>
      </Canvas>
      <View style={s.grid}>
        {stars.map((star) =>
          star.visible ? (
            <TouchableOpacity key={star.id} style={s.starBtn} onPress={() => handlePress(star.id)}>
              <Text style={s.starIcon}>⭐</Text>
            </TouchableOpacity>
          ) : null
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  count: { fontSize: 22, fontWeight: '900' },
  canvas: { width: 320, height: 320, backgroundColor: '#FFF7ED', borderRadius: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  starBtn: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  starIcon: { fontSize: 30 },
});
