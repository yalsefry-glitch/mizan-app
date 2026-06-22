import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>ميزان</Text>
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
    padding: 24,
  },
  title: {
    color: '#E3C766',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: '#FBFCFA',
    fontSize: 18,
  },
});
