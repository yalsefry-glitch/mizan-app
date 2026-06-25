import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useLang } from '../../theme/LanguageContext';

// تخطيط التبويبات الأربعة فقط. منطق الجذر (الخطوط، الـProviders، القفل،
// فرض RTL) يعيش في app/_layout.js ولا يُكرّر هنا.
export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useLang();

  const tab = (name, labelKey, icon) => ({
    name,
    options: {
      title: t(labelKey),
      tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size} color={color} />,
    },
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emerald,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: 'Tajawal_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="estimator"
        options={{
          title: t('tab_estimator'),
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: t('tab_subscriptions'),
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tab_account'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
