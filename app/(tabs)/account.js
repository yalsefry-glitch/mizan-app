import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function AccountScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>حسابي</Text>
      <Text style={styles.note}>قيد الإنشاء</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFCFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#0F5132',
    fontSize: 24,
    fontWeight: '700',
  },
  note: {
    color: '#9CA9A2',
    fontSize: 14,
    marginTop: 8,
  },
});
