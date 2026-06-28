// app/(child)/_layout.tsx
// التنقّل السفلي لتجربة الطفل: عالمي (الكوكب) / الرحلة (المسار) / الآباء.
// تصميم Playful بأيقونات نصّية واضحة وألوان الهوية.
// يمرّر childId عبر كل الشاشات.

import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '../../config/theme';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: 22,
        opacity: focused ? 1 : 0.5,
      }}
    >
      {label}
    </Text>
  );
}

export default function ChildLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primaryDark,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: theme.fonts.bodyBold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ focused }) => <TabIcon label="🦉" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: 'عالمي',
          tabBarIcon: ({ focused }) => <TabIcon label="🪐" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: 'الرحلة',
          tabBarIcon: ({ focused }) => <TabIcon label="🗺️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="parent-link"
        options={{
          title: 'الآباء',
          tabBarIcon: ({ focused }) => <TabIcon label="👨‍👩‍👧" focused={focused} />,
        }}
      />
      {/* شاشات لا تظهر في الشريط السفلي */}
      <Tabs.Screen name="lesson" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="reward" options={{ href: null }} />
    </Tabs>
  );
}
