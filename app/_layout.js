import { Stack } from 'expo-router';
import { I18nManager } from 'react-native';

// تفعيل الاتجاه من اليمين لليسار (RTL) لكامل التطبيق
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
