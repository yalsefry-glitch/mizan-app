// components/games/geometry.ts
// أدوات هندسية مشتركة لألعاب المكافأة: المسافات، تقييم دقّة المسار،
// تحويل الدقّة إلى جواهر (١-٥)، تدرّج لوني أحمر→أخضر، وبناء مسارات Skia.
// كل التقييم بالمسافة الهندسية — لا «صح/خطأ».

import { Skia } from '@shopify/react-native-skia';
import type { SkPath } from '@shopify/react-native-skia';

export interface Pt {
  x: number;
  y: number;
}

// المسافة الإقليدية بين نقطتين.
export function dist(a: Pt, b: Pt): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * دقّة مسار الطفل مقابل مسار الهدف (0..1، حيث 1 = مطابق تمامًا).
 * لكل نقطة من الطفل نأخذ أقرب نقطة في الهدف، ونطبّع المتوسط على norm.
 */
export function pathAccuracy(child: Pt[], target: Pt[], norm: number): number {
  if (child.length === 0 || target.length === 0 || norm <= 0) return 0;
  let sum = 0;
  for (const c of child) {
    let best = Infinity;
    for (const t of target) {
      const d = dist(c, t);
      if (d < best) best = d;
    }
    sum += best;
  }
  const avg = sum / child.length;
  return clamp01(1 - avg / norm);
}

// تحويل الدقّة (0..1) إلى جواهر على مقياس متدرّج 1..5.
export function accuracyToGems(acc: number): number {
  return Math.max(1, Math.min(5, 1 + Math.round(clamp01(acc) * 4)));
}

// قصّ القيمة إلى المجال [0,1].
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * لون متدرّج حسب الدقّة: أحمر (ضعيف) → برتقالي (متوسّط) → أخضر (ممتاز).
 * يُستخدم لتلوين مسار الطفل بصريًّا بدل أي حكم «صح/خطأ».
 */
export function accuracyColor(acc: number): string {
  const a = clamp01(acc);
  let r: number;
  let g: number;
  let b: number;
  if (a < 0.5) {
    const t = a / 0.5; // أحمر #EF4444 → برتقالي #FF9F1C
    r = lerp(0xef, 0xff, t);
    g = lerp(0x44, 0x9f, t);
    b = lerp(0x44, 0x1c, t);
  } else {
    const t = (a - 0.5) / 0.5; // برتقالي #FF9F1C → أخضر #10B981
    r = lerp(0xff, 0x10, t);
    g = lerp(0x9f, 0xb9, t);
    b = lerp(0x1c, 0x81, t);
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// بناء مسار Skia من سلسلة نقاط (خطوط متّصلة).
export function buildPath(points: Pt[]): SkPath {
  const p = Skia.Path.Make();
  if (points.length > 0) {
    p.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      p.lineTo(points[i].x, points[i].y);
    }
  }
  return p;
}

// بناء مسار مغلق (مضلّع) من نقاط — يُستخدم لأوجه المجسّم.
export function buildPolygon(points: Pt[]): SkPath {
  const p = buildPath(points);
  if (points.length > 2) p.close();
  return p;
}
