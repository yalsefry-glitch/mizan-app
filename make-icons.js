const sharp = require('sharp');
const fs = require('fs');

const svg = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<defs>
<clipPath id="tl"><polygon points="0,0 1024,0 0,1024"/></clipPath>
<clipPath id="br"><polygon points="1024,0 1024,1024 0,1024"/></clipPath>
</defs>
<rect x="0" y="0" width="1024" height="1024" fill="#0F5132"/>
<polygon points="1024,0 1024,1024 0,1024" fill="#C9A227"/>
<g clip-path="url(#tl)" fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round">
<circle cx="512" cy="300" r="34" stroke-width="22"/>
<line x1="512" y1="334" x2="512" y2="720" stroke-width="30"/>
<line x1="420" y1="728" x2="604" y2="728" stroke-width="34"/>
<line x1="320" y1="420" x2="704" y2="420" stroke-width="30"/>
<circle cx="512" cy="420" r="22" stroke-width="17"/>
<line x1="320" y1="420" x2="280" y2="620" stroke-width="20"/>
<line x1="320" y1="420" x2="360" y2="620" stroke-width="20"/>
<line x1="704" y1="420" x2="664" y2="620" stroke-width="20"/>
<line x1="704" y1="420" x2="744" y2="620" stroke-width="20"/>
<path d="M268 620 Q320 712 372 620" stroke-width="30"/>
<path d="M652 620 Q704 712 756 620" stroke-width="30"/>
</g>
<g clip-path="url(#br)" fill="none" stroke="#0F5132" stroke-linecap="round" stroke-linejoin="round">
<circle cx="512" cy="300" r="34" stroke-width="22"/>
<line x1="512" y1="334" x2="512" y2="720" stroke-width="30"/>
<line x1="420" y1="728" x2="604" y2="728" stroke-width="34"/>
<line x1="320" y1="420" x2="704" y2="420" stroke-width="30"/>
<circle cx="512" cy="420" r="22" stroke-width="17"/>
<line x1="320" y1="420" x2="280" y2="620" stroke-width="20"/>
<line x1="320" y1="420" x2="360" y2="620" stroke-width="20"/>
<line x1="704" y1="420" x2="664" y2="620" stroke-width="20"/>
<line x1="704" y1="420" x2="744" y2="620" stroke-width="20"/>
<path d="M268 620 Q320 712 372 620" stroke-width="30"/>
<path d="M652 620 Q704 712 756 620" stroke-width="30"/>
</g>
</svg>`;

const buf = Buffer.from(svg);

(async () => {
  if (!fs.existsSync('assets')) fs.mkdirSync('assets');
  await sharp(buf).resize(1024, 1024).png().toFile('assets/icon.png');
  await sharp(buf).resize(512, 512).png().toFile('assets/icon-512.png');
  console.log('تم: assets/icon.png (1024) و assets/icon-512.png');
})().catch((e) => {
  console.error('خطأ:', e.message);
  process.exit(1);
});
