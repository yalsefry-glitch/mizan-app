// config/theme.ts
// هوية «عالم حكيم» البصرية (Ultra-Premium Playful — ابتدائي).
// قيم مركزية للألوان والخطوط والأبعاد، تُستورد في كل الشاشات
// لضمان اتّساق الهوية وسهولة تبديلها لاحقًا.
// نظام الثيمات الستة: يدعم 6 ألوان رئيسية + وضع ليلي.

export type ThemeName = 'orange' | 'purple' | 'green' | 'blue' | 'pink' | 'dark';

// مولّد ثيم حسب اللون الأساسي
function createTheme(name: ThemeName) {
  const themeConfigs = {
    orange: {
      primary: '#FF7A00',
      primaryDark: '#FF5200',
      primaryLight: '#FF9F40',
      accent: '#00E5FF',
      gold: '#FFD700',
      goldDark: '#E6A600',
      success: '#58CC02',
      successDark: '#46A302',
      backgroundDay: '#FFF8F0',
      backgroundNight: '#1A0B2E',
      background: '#FFF8F0',
      card: '#FFFFFF',
      textDark: '#7C2D12',
      textBody: '#374151',
      textMuted: '#9CA3AF',
      border: '#FED7AA',
    },
    purple: {
      primary: '#8B5CF6',
      primaryDark: '#7C3AED',
      primaryLight: '#A78BFA',
      background: '#FAF5FF',
      card: '#FFFFFF',
      textDark: '#5B21B6',
      textBody: '#374151',
      textMuted: '#9CA3AF',
      border: '#E9D5FF',
    },
    green: {
      primary: '#10B981',
      primaryDark: '#059669',
      primaryLight: '#34D399',
      background: '#F0FDF4',
      card: '#FFFFFF',
      textDark: '#065F46',
      textBody: '#374151',
      textMuted: '#9CA3AF',
      border: '#BBF7D0',
    },
    blue: {
      primary: '#3B82F6',
      primaryDark: '#2563EB',
      primaryLight: '#60A5FA',
      background: '#EFF6FF',
      card: '#FFFFFF',
      textDark: '#1E3A8A',
      textBody: '#374151',
      textMuted: '#9CA3AF',
      border: '#BFDBFE',
    },
    pink: {
      primary: '#EC4899',
      primaryDark: '#DB2777',
      primaryLight: '#F472B6',
      background: '#FDF2F8',
      card: '#FFFFFF',
      textDark: '#9F1239',
      textBody: '#374151',
      textMuted: '#9CA3AF',
      border: '#FBCFE8',
    },
    dark: {
      primary: '#F97316',
      primaryDark: '#EA580C',
      primaryLight: '#FB923C',
      background: '#111827',
      card: '#1F2937',
      textDark: '#F9FAFB',
      textBody: '#E5E7EB',
      textMuted: '#9CA3AF',
      border: '#374151',
    },
  };

  const config = themeConfigs[name];

  return {
    name,
    colors: {
      primary: config.primary,
      primaryDark: config.primaryDark,
      primaryLight: config.primaryLight,
      accent: (config as any).accent || config.primary,
      gold: (config as any).gold || '#FFD700',
      goldDark: (config as any).goldDark || '#E6A600',
      backgroundDay: (config as any).backgroundDay || config.background,
      backgroundNight: (config as any).backgroundNight || '#1A0B2E',
      background: config.background,
      card: config.card,
      textDark: config.textDark,
      textBody: config.textBody,
      textMuted: config.textMuted,
      // دلالات (ثابتة عبر الثيمات)
      success: '#10B981',
      successBg: '#E8F5E9',
      error: '#EF4444',
      errorBg: '#FEE2E2',
      // الاقتصاد (تتبع primary)
      gem: config.primary,
      streak: config.primaryLight,
      // حدود
      border: config.border,
      white: '#FFFFFF',
    },
    fonts: {
      heading: 'Cairo_900Black',
      headingBold: 'Cairo_800ExtraBold',
      headingMed: 'Cairo_700Bold',
      body: 'Tajawal_400Regular',
      bodyMed: 'Tajawal_500Medium',
      bodyBold: 'Tajawal_700Bold',
    },
    radius: {
      sm: 12,
      md: 18,
      lg: 24,
      xl: 28,
      full: 999,
    },
    spacing: {
      xs: 6,
      sm: 10,
      md: 16,
      lg: 22,
      xl: 30,
    },
  } as const;
}

// الثيم الافتراضي (برتقالي)
export const theme = createTheme('orange');
export type Theme = ReturnType<typeof createTheme>;

// دالة مصدّرة لإنشاء ثيم حسب الاسم
export function getTheme(name: ThemeName): Theme {
  return createTheme(name);
}
