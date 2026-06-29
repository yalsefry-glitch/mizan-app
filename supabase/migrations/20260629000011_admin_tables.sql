-- Migration: جداول لوحة المالك (Admin Panel)

-- ===== ١. جدول Remote Config =====
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_config IS 'Remote Config - إعدادات يتحكّم بها المالك عن بُعد';

-- بيانات افتراضية
INSERT INTO public.app_config (key, value, description) VALUES
  ('features', '{"homework_enabled": true, "voice_enabled": true, "games_enabled": true}', 'تفعيل/تعطيل ميزات'),
  ('prices', '{"monthly": 49, "yearly": 499, "gems_pack": 19}', 'الأسعار بالريال'),
  ('messages', '{"welcome": "مرحباً في عالم حكيم!", "maintenance": ""}', 'رسائل للمستخدمين')
ON CONFLICT (key) DO NOTHING;

-- قراءة عامة للتطبيق
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.app_config TO anon, authenticated;

DROP POLICY IF EXISTS "app_config_read_all" ON public.app_config;
CREATE POLICY "app_config_read_all" ON public.app_config
  FOR SELECT USING (true);

-- ===== ٢. جدول الإحالات (Referrals) =====
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.parents(id) ON DELETE SET NULL,
  referee_id UUID REFERENCES public.parents(id) ON DELETE CASCADE,
  referral_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.referrals IS 'تتبع الإحالات والنمو الفيروسي';

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.referrals TO authenticated;

DROP POLICY IF EXISTS "referrals_select_own" ON public.referrals;
CREATE POLICY "referrals_select_own" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());

DROP POLICY IF EXISTS "referrals_insert_own" ON public.referrals;
CREATE POLICY "referrals_insert_own" ON public.referrals
  FOR INSERT WITH CHECK (referee_id = auth.uid());

-- ===== ٣. جدول PIN المالك =====
CREATE TABLE IF NOT EXISTS public.owner_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.owner_pins IS 'PIN المالك للدخول للوحة الأدمن (مشفّر)';

-- PIN افتراضي: 9999 (للتجربة فقط - يجب تغييره)
-- Hash بسيط للتوضيح فقط (في الإنتاج استخدم bcrypt)
INSERT INTO public.owner_pins (pin_hash) VALUES ('9999')
ON CONFLICT DO NOTHING;
