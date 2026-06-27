// config/assets.ts
// خريطة ربط الأصول الفنية: تحوّل قيمة asset_url القادمة من قاعدة البيانات
// (مثل 'assets/pets/owl_3d.png') إلى مرجع الأصل الفعلي عبر require،
// ليُعرض بجودة عالية عبر expo-image. لا إيموجي نصّيّاً إطلاقًا.
//
// عند إضافة أصل فني جديد: ضع الملفّ في assets/، وأضف سطر ربط هنا،
// واستخدم نفس المسار في قاعدة البيانات. الكود لا يتغيّر بعدها.

import type { ImageSourcePropType } from 'react-native';

// خريطة المسار (كما في DB) -> مرجع الأصل المحلّي.
// ملاحظة: مسارات require ثابتة وقت الترجمة (متطلّب Metro)،
// لذا نعدّدها صراحةً بدل بناء المسار ديناميكيًّا.
const ASSET_MAP: Record<string, ImageSourcePropType> = {
  // الحيوانات الأليفة
  'assets/pets/rabbit_3d.png': require('../assets/pets/rabbit_3d.png'),
  'assets/pets/cat_3d.png': require('../assets/pets/cat_3d.png'),
  'assets/pets/dragon_3d.png': require('../assets/pets/dragon_3d.png'),
  'assets/pets/owl_3d.png': require('../assets/pets/owl_3d.png'),

  // مقتنيات الكوكب
  'assets/world/tree_3d.png': require('../assets/world/tree_3d.png'),
  'assets/world/garden_3d.png': require('../assets/world/garden_3d.png'),
  'assets/world/house_3d.png': require('../assets/world/house_3d.png'),
  'assets/world/fountain_3d.png': require('../assets/world/fountain_3d.png'),
  'assets/world/spaceship_3d.png': require('../assets/world/spaceship_3d.png'),
};

// أصل بديل عند غياب الأصل المطلوب (يمنع الانهيار).
const FALLBACK_ASSET: ImageSourcePropType = require('../assets/icon.png');

/**
 * تُرجع مرجع الأصل الفني لمسار قادم من قاعدة البيانات.
 * إن كان المسار رابطًا خارجيًّا (http) تُرجعه ككائن uri لـexpo-image.
 * إن لم يوجد الأصl محليًّا، تُرجع الأصل البديل (لا انهيار).
 */
export function resolveAsset(
  assetUrl: string | null | undefined
): ImageSourcePropType {
  if (!assetUrl) return FALLBACK_ASSET;

  // رابط خارجي (URL): expo-image يقبل { uri }.
  if (assetUrl.startsWith('http://') || assetUrl.startsWith('https://')) {
    return { uri: assetUrl };
  }

  // أصل محلّي معرّف في الخريطة.
  return ASSET_MAP[assetUrl] ?? FALLBACK_ASSET;
}

/**
 * تتحقّق هل المسار يشير لأصل محلّي معرّف (مفيد للتشخيص).
 */
export function hasLocalAsset(assetUrl: string | null | undefined): boolean {
  return !!assetUrl && assetUrl in ASSET_MAP;
}
