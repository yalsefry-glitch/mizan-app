import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme/ThemeContext';

export default function EstimatorScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>المساعد التقديري</Text>
      <Text style={styles.note}>قريباً</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    color: colors.emerald,
  },
  note: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
  },
});
