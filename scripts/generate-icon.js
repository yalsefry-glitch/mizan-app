// scripts/generate-icon.js
// يولّد أيقونة التطبيق وشاشة البداية (1024×1024) من SVG عبر sharp.
// التصميم: خلفية تدرّج دافئ (#FFF0E6 → #FFE0C8) + بومة «حكيم» SVG في المنتصف
// + نصّ «عالم حكيم» بخطّ Cairo عريض برتقالي.
// التشغيل: node scripts/generate-icon.js
// ملاحظة: يتطلّب توفّر خطّ Cairo في النظام (مُسجَّل عبر fontconfig) لعرض العربية.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const ASSETS = path.join(__dirname, '..', 'assets');

// ===== بومة حكيم (SVG) — بومة ودودة بألوان دافئة =====
function owlSvg(cx, cy, scale) {
  // مرسومة حول نقطة (0,0) ثم منقولة/مكبّرة عبر transform.
  return `
  <g transform="translate(${cx} ${cy}) scale(${scale})">
    <!-- الجسم -->
    <ellipse cx="0" cy="40" rx="150" ry="160" fill="#E8890B"/>
    <ellipse cx="0" cy="55" rx="110" ry="120" fill="#FFB454"/>
    <!-- الأذنان -->
    <path d="M -120 -90 L -70 -150 L -55 -80 Z" fill="#E8890B"/>
    <path d="M 120 -90 L 70 -150 L 55 -80 Z" fill="#E8890B"/>
    <!-- قرص الوجه -->
    <circle cx="0" cy="-20" r="120" fill="#FFF0E6"/>
    <!-- العينان -->
    <circle cx="-52" cy="-30" r="50" fill="#FFFFFF"/>
    <circle cx="52" cy="-30" r="50" fill="#FFFFFF"/>
    <circle cx="-52" cy="-30" r="40" fill="#FFFFFF" stroke="#E8890B" stroke-width="6"/>
    <circle cx="52" cy="-30" r="40" fill="#FFFFFF" stroke="#E8890B" stroke-width="6"/>
    <circle cx="-48" cy="-26" r="20" fill="#3A2A1A"/>
    <circle cx="48" cy="-26" r="20" fill="#3A2A1A"/>
    <circle cx="-42" cy="-32" r="6" fill="#FFFFFF"/>
    <circle cx="54" cy="-32" r="6" fill="#FFFFFF"/>
    <!-- المنقار -->
    <path d="M -16 5 L 16 5 L 0 34 Z" fill="#FF9F1C"/>
    <!-- الأقدام -->
    <path d="M -45 188 q -10 22 -28 24 M -45 188 q 4 24 -8 30 M -45 188 q 16 18 4 32" stroke="#FF9F1C" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M 45 188 q 10 22 28 24 M 45 188 q -4 24 8 30 M 45 188 q -16 18 -4 32" stroke="#FF9F1C" stroke-width="9" fill="none" stroke-linecap="round"/>
    <!-- قبّعة التخرّج الصغيرة (لمسة «حكيم») -->
    <rect x="-60" y="-178" width="120" height="20" rx="4" fill="#3A2A1A" transform="rotate(-6)"/>
    <path d="M -64 -168 L 0 -150 L 64 -168 L 0 -186 Z" fill="#5A3A1A"/>
  </g>`;
}

function buildSvg({ withText }) {
  const owlY = withText ? 395 : 480;
  const owlScale = withText ? 1.2 : 1.55;
  const text = withText
    ? `<text x="512" y="845" text-anchor="middle"
             font-family="Cairo, 'DejaVu Sans', sans-serif" font-weight="900"
             font-size="135" fill="#E8890B">عالم حكيم</text>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF0E6"/>
      <stop offset="100%" stop-color="#FFE0C8"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
  ${owlSvg(512, owlY, owlScale)}
  ${text}
</svg>`;
}

async function render(svg, outName) {
  const out = path.join(ASSETS, outName);
  await sharp(Buffer.from(svg)).png().resize(SIZE, SIZE).toFile(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`✅ ${outName} (${SIZE}×${SIZE}, ${kb} ك.ب)`);
}

async function main() {
  if (!fs.existsSync(ASSETS)) fs.mkdirSync(ASSETS, { recursive: true });
  // الأيقونة: بومة + نصّ.
  await render(buildSvg({ withText: true }), 'icon.png');
  // شاشة البداية: بومة + نصّ (نفس التصميم على خلفية كاملة).
  await render(buildSvg({ withText: true }), 'splash.png');
  console.log('تمّ توليد الأيقونة وشاشة البداية في مجلّد assets/.');
}

main().catch((err) => {
  console.error('فشل توليد الأيقونة:', err);
  process.exit(1);
});
