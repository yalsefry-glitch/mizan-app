// config/theme.ts
// هوية «عالم حكيم» البصرية (Ultra-Premium Playful — ابتدائي).
// قيم مركزية للألوان والخطوط والأبعاد، تُستورد في كل الشاشات
// لضمان اتّساق الهوية وسهولة تبديلها لاحقًا.

export const theme = {
  colors: {
    // الهوية البرتقالية الدافئة (مناسبة للأطفال، راقية لا طفولية رخيصة)
    primary: '#FF9F1C',
    primaryDark: '#F57C00',
    primaryLight: '#FFB84D',

    // خلفيات
    background: '#FFF7ED',
    card: '#FFFFFF',

    // نصوص
    textDark: '#7C2D12',
    textBody: '#374151',
    textMuted: '#9CA3AF',

    // دلالات
    success: '#10B981',
    successBg: '#E8F5E9',
    error: '#EF4444',
    errorBg: '#FEE2E2',

    // الاقتصاد
    gem: '#F59E0B',
    streak: '#FB923C',

    // حدود
    border: '#FED7AA',

    white: '#FFFFFF',
  },

  fonts: {
    // العناوين (Cairo)
    heading: 'Cairo_900Black',
    headingBold: 'Cairo_800ExtraBold',
    headingMed: 'Cairo_700Bold',
    // النصوص (Tajawal)
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

export type Theme = typeof theme;
