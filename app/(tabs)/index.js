import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.brand}>ميزان</Text>
      <Text style={styles.subtitle}>مساعد استرشادي للتوعية</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F5132',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#E3C766',
    fontSize: 48,
    fontWeight: '800',
  },
  subtitle: {
    color: '#FBFCFA',
    fontSize: 16,
    marginTop: 8,
  },
});
