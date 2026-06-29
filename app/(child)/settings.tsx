// app/(child)/settings.tsx
// شاشة إعدادات الطفل: اختيار الثيم (6 ألوان).
// كل ثيم يظهر كبطاقة ملونة قابلة للضغط، عند اختياره يُطبّق فوريًّا على كل الشاشات.

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { ThemeName } from '../../config/theme';

// أسماء وألوان الثيمات الستة
const THEMES: Array<{ name: ThemeName; label: string; color: string }> = [
  { name: 'orange', label: 'برتقالي', color: '#F97316' },
  { name: 'purple', label: 'بنفسجي', color: '#8B5CF6' },
  { name: 'green', label: 'أخضر', color: '#10B981' },
  { name: 'blue', label: 'أزرق', color: '#3B82F6' },
  { name: 'pink', label: 'وردي', color: '#EC4899' },
  { name: 'dark', label: 'ليلي', color: '#111827' },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, themeName, setTheme } = useTheme();

  return (
    <View style={[s.container, { backgroundColor: theme.colors.background }]}>
      {/* الرأس */}
      <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: theme.colors.card }]}>
        <Text style={[s.headerTitle, { fontFamily: theme.fonts.heading, color: theme.colors.textDark }]}>
          الإعدادات
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.sectionTitle, { fontFamily: theme.fonts.bodyBold, color: theme.colors.textDark }]}>
          اختر لونك المفضل 🎨
        </Text>

        <View style={s.grid}>
          {THEMES.map((t) => {
            const isActive = themeName === t.name;
            return (
              <TouchableOpacity
                key={t.name}
                style={[
                  s.themeCard,
                  { backgroundColor: t.color, borderColor: isActive ? theme.colors.textDark : 'transparent' },
                ]}
                onPress={() => setTheme(t.name)}
                activeOpacity={0.8}
              >
                {isActive && (
                  <View style={s.checkBadge}>
                    <Text style={s.checkIcon}>✓</Text>
                  </View>
                )}
                <Text
                  style={[
                    s.themeLabel,
                    {
                      fontFamily: theme.fonts.bodyBold,
                      color: t.name === 'dark' ? '#F9FAFB' : '#FFFFFF',
                    },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[s.hint, { fontFamily: theme.fonts.bodyMed, color: theme.colors.textMuted }]}>
          اختيارك يُحفظ تلقائيًّا ويُطبَّق على كل الشاشات 🌈
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FED7AA',
  },
  headerTitle: { fontSize: 22, textAlign: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 18 },
  sectionTitle: { fontSize: 17, textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  themeCard: {
    width: 110,
    height: 110,
    borderRadius: 18,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: { fontSize: 15, color: '#10B981' },
  themeLabel: { fontSize: 16 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 8 },
});
