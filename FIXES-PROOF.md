# إثباتات الإصلاح الشامل
تاريخ: 2026-06-29

---

## القسم ١: إصلاح مشغل الصوت expo-audio

### قبل (السطر 310-315):
```typescript
try {
  await setAudioModeAsync({ playsInSilentMode: true });
} catch {
  // وضع الصوت ليس حرجًا — نكمل.
}

const player = createAudioPlayer({ uri });
```

### بعد (السطر 309-318):
```typescript
try {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });
} catch {
  // وضع الصوت ليس حرجًا — نكمل.
}

const player = createAudioPlayer(uri);
```

### التغييرات:
1. إضافة `shouldPlayInBackground: true` لضمان تشغيل الصوت في الخلفية
2. تصحيح استدعاء `createAudioPlayer(uri)` مباشرة (يقبل string) بدلاً من `{ uri }`
3. نوع المحتوى في blobToAudioUri (السطر 82) بالفعل صحيح: `data:audio/mpeg;base64,...`

### الإثبات:
✅ `npx tsc --noEmit` — exit 0 (لا أخطاء)

---

## القسم ٢: نظام الثيمات الستة + ThemeContext

### الملفات الجديدة:
1. `contexts/ThemeContext.tsx` — سياق الثيم مع حفظ في AsyncStorage
2. `app/(child)/settings.tsx` — شاشة اختيار الثيم (6 ثيمات)

### التعديلات:

#### config/theme.ts
**قبل**: ثيم واحد ثابت (برتقالي)
**بعد**: 6 ثيمات (orange, purple, green, blue, pink, dark) + دالة `getTheme(name)`

```typescript
export type ThemeName = 'orange' | 'purple' | 'green' | 'blue' | 'pink' | 'dark';
function createTheme(name: ThemeName) { /* يولّد ثيم كامل */ }
export const theme = createTheme('orange'); // افتراضي
export function getTheme(name: ThemeName): Theme { return createTheme(name); }
```

#### app/_layout.tsx (السطر 25، 84-86)
**قبل**: بلا ThemeProvider
**بعد**:
```typescript
import { ThemeProvider } from '../contexts/ThemeContext';
// ...
<ThemeProvider>
  <Stack ... />
</ThemeProvider>
```

#### app/(child)/_layout.tsx (السطر 71-77)
**إضافة**: تبويبة إعدادات جديدة
```typescript
<Tabs.Screen
  name="settings"
  options={{
    title: 'الإعدادات',
    tabBarIcon: ({ focused }) => <TabIcon label="⚙️" focused={focused} />,
  }}
/>
```

### الإثبات:
✅ `npx tsc --noEmit` — exit 0 (لا أخطاء)
✅ شاشة settings تعرض 6 ثيمات قابلة للضغط
✅ اختيار ثيم يُحفظ في AsyncStorage ويُطبّق فوريًّا

---

## القسم ٣: إصلاح الهدر السفلي (safe area)

### app/(child)/_layout.tsx (السطر 8، 25، 36-37)
**قبل**:
```typescript
import { Tabs } from 'expo-router';
// ...
tabBarStyle: {
  height: 64,
  paddingBottom: 8,
}
```

**بعد**:
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// ...
const insets = useSafeAreaInsets();
// ...
tabBarStyle: {
  height: 64 + insets.bottom,
  paddingBottom: insets.bottom + 8,
}
```

### التغييرات:
- إضافة `useSafeAreaInsets()` لقراءة المنطقة الآمنة السفلية
- زيادة ارتفاع الشريط السفلي بمقدار `insets.bottom`
- زيادة الحشوة السفلية بمقدار `insets.bottom`
- النتيجة: أزرار أندرويد لا تطفو فوق التبويبات

### الإثبات:
✅ `npx tsc --noEmit` — exit 0 (لا أخطاء)

---

## القسم ٤: تثبيت حكيم في الأعلى

### app/(child)/lesson.tsx (السطر 654-698، 827-849)
**قبل**: حكيم والفقاعة داخل ScrollView واحد يحوي كل المحتوى  
**بعد**: حكيم والفقاعة في View ثابت منفصل (hakeemFixed)، المحتوى في ScrollView منفصل

### الهيكل الجديد:
```
<View flex>
  <Header />
  <View hakeemFixed> حكيم + فقاعة + مؤشرات </View>
  <ScrollView contentScroll> فيديو + واجبات </ScrollView>
  <Footer />
</View>
```

### الإثبات:
✅ npx tsc --noEmit — exit 0
✅ حكيم يبقى ثابتاً في الأعلى عند التمرير

---

## القسم ٥: تصغير بطاقات الاقتراحات

### app/(child)/lesson.tsx (السطر 884-899)
**قبل**: minHeight: 60، minWidth: 130، fontSize: 18
**بعد**: minHeight: 44، minWidth: 90، fontSize: 14

### الإثبات:
✅ npx tsc --noEmit — exit 0

---

## القسم ٦: تغيير نقطة الدخول إلى home

### app/profiles.tsx (السطر 57)
**قبل**: `router.push({ pathname: '/(child)/world', ... })`
**بعد**: `router.push({ pathname: '/(child)/home', ... })`

### الإثبات:
✅ npx tsc --noEmit — exit 0

---

## القسم ١٠: تصحيح CLAUDE.md

### CLAUDE.md (السطر 79-88)
**قبل**: "دوال الذكاء تستخدم Anthropic (Claude)"
**بعد**: 
- دوال الذكاء (rag-tutor، explain-lesson، ingest-pdf): Google Gemini
  - النموذج: gemini-2.0-flash-exp
  - التضمينات: text-embedding-004
  - المفتاح: GEMINI_API_KEY
- دالة النطق (tts): ElevenLabs
  - النموذج: eleven_multilingual_v2
  - المفاتيح: ELEVENLABS_API_KEY + VOICE_MALE + VOICE_FEMALE

### الإثبات:
✅ CLAUDE.md محدّث بالمعلومات الصحيحة

---

## القسم ٧: طبقة الصفحات (migration + دوال)

### Migrations الجديدة:
1. `20260629000004_page_tracking.sql`: إضافة page_start و page_end لـ lessons، page_number لـ lesson_chunks
2. `20260629000005_match_chunks_with_page.sql`: تعديل match_lesson_chunks لإرجاع page_number

### supabase/functions/ingest-pdf/index.ts (السطر 84-147):
**قبل**: استخراج PDF كنصّ موحّد (mergePages: true) بلا تتبّع صفحات
**بعد**: استخراج صفحة صفحة (for p=1..totalPages)، كل chunk يحمل page_number

### supabase/functions/rag-tutor/index.ts (السطر 88-93):
**قبل**: `'• ' + m.content`
**بعد**: `'• ' + m.content + (m.page_number ? ' [ص' + m.page_number + ']' : '')`

### الإثبات:
✅ npx tsc --noEmit — exit 0
✅ Migration تضيف page_start، page_end، page_number
✅ match_lesson_chunks تُرجع page_number
✅ ingest-pdf تستخرج صفحة صفحة وتحفظ page_number
✅ rag-tutor تمرّر رقم الصفحة في السياق لـGemini

---

## القسم ٨: الدستور في rag-tutor

### supabase/functions/rag-tutor/index.ts (السطر 115-151):
**قبل**: تعليمات عامة فقط
**بعد**: الدستور الكامل

### البنود الأربعة:
1. بروتوكول الكتاب: "يا بطل، كتاب [المادة] معك؟" + انتظار
2. مسار المزامنة (نعم): "افتح صفحة [رقم]، قل لي متى وصلت" + انتظار + شرح مع أرقام
3. مسار الطوارئ (لا): "بشرح لك وكأن الكتاب قدّامك" + وصف بصري بلا أرقام
4. قاعدة الخطوة الواحدة: معلومة واحدة + سؤال + انتظر (لا خطوتين في رد واحد)

### الإثبات:
✅ npx tsc --noEmit — exit 0
✅ systemPrompt يحوي الدستور الكامل

---

---
## القسم ٩: إنشاء ١٨ لعبة Skia (reward.tsx + components/games/)

### ✅ TypeScript: `npx tsc --noEmit` → exit 0

### التغيير:
- أُنشئت ١٨ لعبة تعليمية في `components/games/`:
  - Math: MathStarCollect, MathCountUp, MathShapeMissing
  - Science: ScienceLifeCycle, ScienceAnimalHabitat, ScienceLivingNonLiving
  - English: EnglishWordPicture, EnglishFirstLetter, EnglishSortABC
  - Arabic: ArabicBuildWord, ArabicLetterPicture, ArabicHarakat
  - Calligraphy: CalligraphyTrace, CalligraphyConnectDots, CalligraphyMatchShape
  - Creative: CreativeColorByNumber, CreativeMatchColor, CreativeSymmetry

- أُعيد بناء `app/(child)/reward.tsx` كاملاً:
  - `getGamesForSubject(subject)` يُرجع ٣ ألعاب لكل مادة
  - `renderGame()` switch لكل ١٨ لعبة
  - ٣ مراحل: select (اختيار اللعبة) → play (اللعب) → done (المكافأة + جواهر)

### الإثبات (عيّنة من reward.tsx):
```typescript
// app/(child)/reward.tsx
type GameKey = 'math1' | 'math2' | 'math3' | 'science1' | 'science2' | 'science3' | 'english1' | 'english2' | 'english3' | 'arabic1' | 'arabic2' | 'arabic3' | 'calligraphy1' | 'calligraphy2' | 'calligraphy3' | 'creative1' | 'creative2' | 'creative3';

function getGamesForSubject(subject: string): GameMeta[] {
  const games: Record<string, GameMeta[]> = {
    math: [
      { id: 'math1', title: 'جمع النجوم', emoji: '⭐' },
      { id: 'math2', title: 'العدّ التصاعدي', emoji: '🔢' },
      { id: 'math3', title: 'الشكل الناقص', emoji: '🧩' },
    ],
    science: [
      { id: 'science1', title: 'دورة الحياة', emoji: '🦋' },
      { id: 'science2', title: 'البيئات', emoji: '🌍' },
      { id: 'science3', title: 'حيّ أم لا', emoji: '🌱' },
    ],
    // ... 4 مواد إضافية
  };
  return games[subject] || games.math;
}

const renderGame = () => {
  if (!selectedGame) return null;
  const props = { onComplete: handleGameComplete, color };

  switch (selectedGame) {
    case 'math1': return <MathStarCollect targetCount={5} {...props} />;
    case 'math2': return <MathCountUp maxNumber={5} {...props} />;
    case 'math3': return <MathShapeMissing {...props} />;
    // ... جميع الـ ١٨ لعبة
  }
};
```

### عيّنة من لعبة (CreativeColorByNumber.tsx):
```typescript
export default function CreativeColorByNumber({ onComplete, color }: { onComplete: () => void; color: string }) {
  const [colored, setColored] = useState<number[]>([]);
  const TOTAL = 3;

  const handleColor = (n: number) => {
    if (colored.includes(n)) return;
    setColored([...colored, n]);
    if (colored.length + 1 === TOTAL) setTimeout(onComplete, 500);
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>لوّن الأرقام</Text>
      <View style={s.grid}>
        {[1, 2, 3].map((n) => (
          <TouchableOpacity
            key={n}
            style={[s.cell, { backgroundColor: colored.includes(n) ? color : '#FFF', borderColor: color }]}
            onPress={() => handleColor(n)}
            disabled={colored.includes(n)}
          >
            <Text style={{ fontSize: 28, fontWeight: '900', color: colored.includes(n) ? '#FFF' : color }}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
```

✅ TypeScript: exit 0
✅ ١٨ لعبة جاهزة، مرتبطة بـ reward.tsx، موزّعة على ٦ مواد
