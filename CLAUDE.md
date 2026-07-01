# 🦉 عالم حكيم — الحالة الحالية (محدّث 2026-07-01)

> **اقرأ هذا القسم أولاً — هو أحدث حالة للمشروع.** الأقسام الأقدم أسفله تبقى مرجعاً للفلسفة والبنية، لكن حيث تتعارض، **هذا القسم هو الأصحّ**.

---

## ⚙️ تصحيح جوهريّ: الذكاء = Gemini (لا Anthropic)

كل دوال الذكاء تستخدم **Google Gemini** فعلياً في الكود:
- النموذج: `gemini-2.5-flash` (لا gemini-2.0-flash-exp القديم)
- التضمينات: `gemini-embedding-001` بأبعاد **768** (إلزاميّ — جدول lesson_chunks فيه vector(768) + ivfflat)
- الأقسام القديمة التي تقول «Anthropic/Claude» أو «text-embedding-004» **قديمة، تُتجاهَل**.

---

## 🌐 خدمة pdf-worker على Render — منشورة وحيّة (نمط async)

خدمة Node.js مُحاويَة (Docker) تحوّل PDF الكتب لصور، تكتشف الفصول بـGemini، وتستوعبها — **آلياً من رفعة واحدة**. تُشغّل من لوحة التحكّم مستقبلاً.

- **المجلّد:** `services/pdf-worker/` | **الرابط:** https://mizan-app-k58l.onrender.com
- **Service ID:** srv-d9209ji8qa3s73e0rf20 | Docker | Root Directory `services/pdf-worker` | الخطّة **Starter** ($7/mo، 0.5 CPU، 512MB)
- **الصحّة:** `GET /health` → `{"ok":true}`

**المسارات:**
- `POST /process-book` — يستقبل PDF + subject_id, grade_id, part_number, book_slug. ينشئ job، يبدأ المعالجة خلفياً (setImmediate)، **يردّ فوراً** بـjob_id. (يحلّ حدّ Render 100 ثانية للموازن.)
- `GET /job/:id` — الحالة الحيّة (status, total_pages, pages_uploaded, chapters_total, chapters_done, current_step, error, result). اللوحة تستطلعها كل 5 ثوان.
- `GET /jobs` — قائمة آخر jobs.
- `POST /retry` — إعادة معالجة فصول محدّدة.
- `POST /complete-book` — **إكمال ذاتيّ**: يجد الفصول الناقصة ويعيدها فقط.

**5 متغيّرات بيئة في Render:** SUPABASE_URL (بلا /rest/v1/)، INGEST_VISION_URL (=`.../functions/v1/ingest-vision`)، SUPABASE_SERVICE_ROLE_KEY، GEMINI_API_KEY، ALLOWED_ORIGIN=*.

**9 تحصينات:** async job pattern، تدفّق convert→upload→delete بالدفعات (CONVERT_CHUNK=3، يمنع OOM على 512MB)، استطلاع حيّ، صور كشف مضغوطة (sharp 600px JPEG 40، DETECT_BATCH=15)، setTimeout(0)، retry واعٍ بـ503، كتابة buffer، حزمة `ws` (Node 20 يحتاجها لـSupabase realtime).

---

## 🧠 ingest-vision — نهج 2026 (فصل كامل في استدعاء واحد)

`supabase/functions/ingest-vision/index.ts`. تُرسل **صور فصل كامل** لـgemini-2.5-flash في **استدعاء واحد** فيحدّد Gemini حدود الدروس بنفسه (الاستدعاء لكل صفحة كان مجزّأً وفاشلاً). responseSchema مفروض؛ chapter_number ممرّر من الخارج (لا من Gemini).

**عقد الردّ في وضع commit (مهمّ جداً):**
```
{ mode:'commit', committed:true, summary:{lessons_written, chunks_written, ...}, items:[...] }
```
لا يوجد حقل `ok` ولا `lessons_written` في الجذر. أي كود يقرأ هذا الردّ **يجب** أن يفحص `committed===true` ويقرأ `summary.lessons_written` (لا `result.ok`).

---

## 🗄️ جداول القاعدة الفعلية (أسماء الأعمدة الحقيقية — لا تخمين)

**lessons:** id, subject_id, title (عنوان الدرس — **ليس** lesson_title), file_path, content_text, status, created_at, page_start, page_end, part_number, lesson_order, chapter_number, chapter_title, lesson_type. **لا يوجد book_slug** — الكتاب يُميّز بـ**subject_id + part_number**.

**lesson_chunks:** id, lesson_id, subject, grade_order, chunk_index, content, embedding vector(768), created_at, page_number, part_number, page_image_url.

**ingestion_jobs** (أُعيد بناؤه نظيفاً 2026-06-30): id, book_slug, subject_id, grade_id, part_number, status (queued|converting|detecting|processing|done|failed), total_pages, pages_uploaded, chapters_total, chapters_done, current_step, error, result(jsonb), created_at, updated_at.

⚠️ محرّر Supabase SQL على الجوّال يفشل مع DO-blocks/$$/أسطر متعدّدة (تلف الاقتباسات) → «syntax error at or near )». استخدم أوامر SQL بسطر واحد بلا DO blocks.

**buckets:** homework(خاص), books(عام — PDFs), books-compressed, lesson_pages(عام — صور {book_slug}/page-NNN.png 3-digit).

---

## ✅ حالة الاستيعاب (مثبتة)

- **math-grade1-part1** (137 صفحة، 6 فصول): مستوعب.
- **math-grade1-part2** (155 صفحة): مستوعب **44/48 فصلاً** + 80 chunks، بلا تكرار في chapter_number. **4 فصول ناقصة (12,13,14,15)** فشلت بـ**Gemini 503** (ازدحام خوادم Google المؤقّت، ليس عطل الكود).
- **معرّفات math-grade1:** subject_id (الرياضيات) `cbb340d9-ae4b-4de5-89b0-5572c3a9524d`، grade_id (الصف الأول) `26ba396e-f8bc-4842-b7e4-a85ff3312ec5`.

**عيوب جودة معروفة (ثانوية، لاحقاً):** عناوين مكرّرة أحياناً («استعمال النقود» مرّتين)، عناوين مبتورة أحياناً («الأعداد حتى» بلا رقم) — من استخراج Gemini.

---

## 🎯 الحلّ الدائم قيد البناء: ضمان اكتمال الكتب (لا ترقيع)

القرار: لا كتاب «يُنهى» ناقصاً بصمت، وأي نقص يُكمَل حتماً مهما تكرّر 503. أربع ركائز:

1. **تحقّق التغطية بالصفحات** (لا بأرقام الفصول فقط): الفصل «مكتوب» فقط إذا وُجد في القاعدة درس بنفس نطاق صفحاته — فلا تُخدَع بدروس قديمة.
2. **حالة كتاب مستمرّة**: الكتاب لا يصير «مكتمل» إلا حين كل فصوله المكتشفة موجودة بصفحاتها في القاعدة.
3. **إكمال حتميّ دوريّ عبر GitHub Actions** (مجّاني، قرار المالك): مهمّة مجدولة تمرّ على الكتب غير المكتملة، تعيد فصولها الناقصة، **حتى تكتمل 100%**. 503 اليوم يُعاد غداً — لا استسلام.
4. **التطبيق لا يعرض كتاباً للأطفال إلا إذا مكتمل 100%** — الطفل لا يرى كتاباً ناقصاً أبداً.

**مطبّق حتى الآن (commit ~8143386 + التالي):** إصلاح عقد processChapter (committed/summary)، retry واعٍ بـ503 (تأخير أطول 15/45/90s للـ503، 1/3/6s لغيره، 4 محاولات)، تحقّق تغطية من القاعدة، status صادق، chapters_done = العدد الحقيقيّ من القاعدة، endpoint /complete-book، إصلاح mutation في sort. **يتبقّى:** تحقّق بالصفحات (لا الأرقام)، جدول حالة الكتب، GitHub Actions للإكمال الدوريّ.

---

## 🗣️ تصميم صوت حكيم ومخاطبته (مقرّر — يُبنى مع حكيم)

حقلان **منفصلان** في ملفّ الطفل:
- `voice_preference` (male/female): **الطفل يختار** صوت حكيم (في setup-children/settings)، يقود صوت ElevenLabs في tts (male `t9akNmCDhz230CEXOYmn` / female `kdUY91gH5xyDHapxlthT`) بغضّ النظر عن جنس الطفل.
- `gender` (boy/girl): جنس الطفل **الحقيقيّ**، يقود **المخاطبة النحوية العربية** في tutor-chat (ولد → «يا بطل/أحسنتَ»، بنت → «يا بطلة/أحسنتِ») — يُمرّر لـGemini في التعليمات.
- مستقلّان: بنت قد تختار صوت الولد لكن تُخاطَ بصيغة مؤنّثة. حكيم شخصية بوم واحدة؛ يتغيّر فقط صوت النطق وصيغة الخطاب.

**حماية حكيم من 503 (ضروريّ، يُبنى مع tutor-chat):** 3 طبقات — (1) retry صامت واعٍ بـ503 (تأخير قصير 1/2/4s قبل أن يشعر الطفل)، (2) احتياطي نموذج gemini-2.5-flash-lite عند 503 مستمرّ (يتعافى 5-15 دقيقة)، (3) رسالة حكيم ودودة كآخر حلّ («لحظة صغيرة يا بطل، فكّر معي وأعِد سؤالك») — لا خطأ تقنيّ مخيف. (منفصل عن إكمال الاستيعاب: الاستخراج = إعادة حتى النجاح؛ المحادثة الحيّة = تعافٍ لطيف فوريّ.)

---

## 💳 منطق الاشتراك (مقرّر): الخيار 3 — لا مجّاني

لا محتوى مجّاني، تصفّح فقط. غير المشترك يرى الرئيسية والمواد وعناوين الدروس (تصفّح)؛ فتح **أيّ درس** → Paywall («اشترك لتبدأ التعلّم»)؛ لا محتوى تعليميّ (دروس/سبورة/حكيم/فيديو) بلا اشتراك. الدفع عبر **المتجر فقط** (Google Play / App Store IAP، RevenueCat) — لا بوّابة خارجية. حالة الاشتراك تُعكس في جدول subscriptions. lesson.tsx يفحص الاشتراك قبل تحميل المحتوى → توجيه لـPaywall إن لم يكن مشتركاً.

---

## 🖥️ السبورة التفاعلية (مبنية، مثبتة)

`components/InteractiveCanvas.tsx` (267 سطراً): تعرض **صورة الصفحة الأصلية** (تطابق الكتاب 100%)، حكيم يشير عليها بـSkia بإحداثيات من Gemini Vision. Skia 2.6.2 + Reanimated 4.3.1 + gesture-handler 2.31.1. tsc نظيف. **يتبقّى:** ربطها في lesson.tsx تبويب [📄 الصفحة].

---

## 🔭 الخطّة المتبقّية (بالترتيب)

**(A)** إنهاء الحلّ الدائم للاستيعاب (تحقّق بالصفحات + جدول حالة الكتب + GitHub Actions الدوريّ) → إكمال part2 (الفصول 12-15) → أتمتة الـ36 كتاباً (6 مواد × 3 صفوف × جزآن).
**(B)** لوحة التحكّم الويب على Render (منفصلة عن التطبيق): رفع كتب، حالة حيّة (/job/:id)، إصلاح ذاتيّ (/complete-book, /retry)، مراجعة محتوى، اشتراكات، مستفيدون، **وضع صيانة** (app_config.maintenance_mode → التطبيق يعرض شاشة صيانة؛ حساب المالك يتجاوز)، **مساعد صيانة ذكيّ** (فحوص دورية، إصلاح ذاتيّ للمعروف، تقارير عربية بـGemini)، دعم متعدّد التطبيقات.
**(C)** ربط InteractiveCanvas في lesson.tsx.
**(D)** حكيم يحلّل الصفحة بـGemini Vision → إحداثيات → تظليل. **(E)** طبقة الفيديو (4 طبقات أمان). **(F)** بريد توثيق يوميّ 3ص بتوقيت السعودية عبر GitHub Actions. **(G)** تنظيف مسار pdftotext القديم. **(H)** تغيير PIN من 9999؛ استبدال quiz.tsx بلعبة؛ اختبار على جهاز حقيقيّ (لم يُختبَر قطّ)؛ ثم APK واحد (بإذن صريح فقط).

---

## ⚠️ بيئات التطوير

1. **Termux (أندرويد):** ~/mizan-app، Claude Code **v2.0.30** (لا تحدّثه — الإصدارات الأحدث أسقطت دعم linux-arm64-android؛ ثبّته بـ`npm install -g @anthropic-ai/claude-code@2.0.30 --allow-scripts=@anthropic-ai/claude-code`). git+node، لا Supabase CLI، لا .env. نشر الدوال عبر Management API بـSUPABASE_ACCESS_TOKEN.
2. **Codespace** supreme-guacamole: node v24، supabase 2.108.0، deno، poppler/ghostscript، .env هنا فقط.
3. **PC العمل:** D:\mizan-app، Claude Code v2.1.196.

**تشغيل:** الأوامر العربية في الطرفية تُخطئ — العربيّ لأوامر Claude Code فقط، الطرفية أوامر إنجليزية قصيرة. الروابط قيم تُلصق في Render/الكود، لا تُفتح في المتصفّح.

**مشروع Render قديم للحذف:** "promotion" (yalsefry-glitch/promotion, srv-d8o7asbsq97s73f9dm30) — منفصل عن mizan-app، الحذف مؤجّل.


# عالم حكيم — ملف المشروع الكامل (Project Memory)

> هذا الملف هو المرجع الكامل لمشروع «عالم حكيم». اقرأه بالكامل قبل أي عمل.
> الاسم التقني للملف: CLAUDE.md — يقرأه Claude Code تلقائيًّا في بداية كل جلسة.

---

## ١. ما هو المشروع

«عالم حكيم» تطبيق تعليمي ترفيهي فاخر للأطفال السعوديين، **المرحلة الابتدائية الأولى حصريًّا (الصفوف ١-٣)**. الفكرة الجوهرية:

- **معلّم ذكي حواري** اسمه «حكيم» (بومة): لا يعطي أسئلة اختيار من متعدّد جامدة، بل **يحاور** الطفل، يحكي قصة، يحلّل فهمه، ويعيد الشرح بزاوية أخرى إن تعثّر — **دون أسلوب صح/خطأ**.
- **مكافأة لعب حقيقية**: بعد فهم الدرس، يلعب الطفل **لعبة فعلية** (التقاط فواكه، إطعام حيوان) تُمنح بها جواهر.
- **اقتصاد وتحفيز**: جواهر، كوكب حيّ ينمو، سلاسل يومية، حيوانات أليفة، تحدٍّ عائلي بين الإخوة.
- **لوحة ولي الأمر**: متابعة ذكية لكل طفل + توصيات + هدايا رقمية فورية.
- **لوحة المالك**: تحكّم عن بُعد بالمتجر والمواسم، تحليلات، نمو فيروسي.

**الجمهور**: أطفال سعوديون، واجهة عربية كاملة (RTL).
**النبرة**: مرحة فاخرة (Ultra-Premium Playful)، برتقالي دافئ.

---

## ٢. القواعد الإلزامية للعمل (المالك صارم عليها)

المالك **محامٍ متدرّب، غير تقني**. القواعد:

1. **خطوة واحdة كل مرة** عند الحاجة لتدخّله، مع شرH أين وكيف ولماذا بالكامل.
2. **لا تخمين تقني**: تحقّق فعليًّا (شغّل، اقرأ السجلّ) قبل أي ادعاء. إن لم تتأكّ، قل «لا أعرف».
3. **لا تعِد بنجاح بناء قبل اختباره**. لا تدّعِ إنجازًا لم يحدث.
4. **اعترف بالخطأ صراحةً وفورًا** بلا مراوغة.
5. **ابنِ الأساس أولاً وتأكّ أنه يعمل** قبل أي ميزة.
6. **عربي خالص في الواجهة** (لا لاتيني داخل كلمة عربية، عدا أسماء الملفات والروابp).
7. **لا تبنِ كل شيء دفعة واحدة** — أتقِن وحدة واحدة (تُبهر فعليًّا) قبل التالية. هذا الخطأ الذي أفشل المحاولة السابقة.
8. **اللغة العربية في الردود** — تجنّب خلط حروف لاتينية وسp الكلمات العربية.

---

## ٣. الفلسفة الحاكمة (الدرس المستفاد من الفشل السابq)

المحاولة السابقة فشلت لأنها: حوّلت التعليم إلى **امتحان** (أسئلة اختيار)، وبنت كل شيء **سطحيًّا** فلم يكتمل أيّ شيء، وافترضت وجود **أصول فنية** غير موجودة فكسرت البناء.

الصواب:
- **التعليم محادثة، لا امتحان.** حكيم يحاور ويكيّف، لا يختبر.
- **المكافأة لعبة، لا رقم.**
- **أتقِن القلب أولاً**: المعلّم الحواري + لعبة واحدة، حتى يُبهرا، قبل أي طبقة أخرى.
- **معمارية أصول مرنة**: لا `require` ثابت لأصل قد لا يوجد — بدائل متدرّجة دائمًا (مطبّق في `config/assets.ts` و`components/AssetImage.tsx` و`components/Hakeem.tsx`).

---

## ٤. البنية التقنية (محقّقة فعليًّا، لا مفترضة)

- **Expo SDK ^56.0.0**, react-native 0.85.3, **New Architecture ON** (reanimated 4.3.1).
- **expo-router ~56.2.11** (التوجيه بالملفات)، main = expo-router/entry.
- **TypeScript** (كل الشاشات .tsx، المنطق .ts).
- **EAS Build** (preview profile, APK) — لا Expo Go (لوجود مكتبات native).
- المكتبات المثبّتة فعليًّا: @shopify/react-native-skia (الكوكب، الخريطة، الألعاب)، @lottiefiles/dotlottie-react-native، react-native-gesture-handler، expo-linear-gradient، expo-image، react-native-youtube-iframe (+ react-native-webview)، expo-speech (نطق حكيم)، expo-speech-recognition (استماع حكيم)، expo-localization، expo-font.

### المعرّفات الثابتة (لا تُغيّر — تكسر ربp EAS)
- اسم المستودع/المجلّد: `mizan-app` (تقني، لا يراه المستخدم)
- package: `sa.mizan.app`
- EAS projectId: `64d231cd-9597-48ac-bdba-b2d7c60466e5`
- slug في app.json: `mizan` (يطابق مشروع EAS — إجباري)
- الاسم الظاهر للمستخدم: «عالم حكيم» (في app.json name)

---

## ٥. الخوادم والمفاتيH (أين كل شيء)

### المستودع (GitHub)
- `github.com/Mizainsa/mizan-app` (الحساب: Mizainsa، البريد mizansa990@gmail.com)
- الفرع: main

### Supabase (قاعدة البيانات + الدوال)
- **معرّف المشروع**: `lzfgjvafmvofwjiyvelq`
- **المفتاH العام (anon/publishable)** — يوضع في كود التطبيq فقp: `sb_publishable_YZzzqNIjBGtAbD1IZAiY-w_gO93vuH5`
- **رابp المشروع**: `https://lzfgjvafmvofwjiyvelq.supabase.co`
- المفاتيH السرّية في Supabase Secrets فقp (لا في الكود أبدًا).

### مفاتيح الذكاء (مهم جدًّا — درس مكلف)
- **دوال الذكاء (rag-tutor، explain-lesson، ingest-pdf)**: تستخدم **Google Gemini**.
  - النموذج: **`gemini-2.0-flash-exp`** (الأحدث والأسرع)
  - التضمينات: **`text-embedding-004`**
  - API: `https://generativelanguage.googleapis.com/v1beta/`
  - المفتاح: `GEMINI_API_KEY` في Supabase Secrets
- **دالة النطق (tts)**: تستخدم **ElevenLabs**.
  - API: `https://api.elevenlabs.io/v1/text-to-speech/`
  - النموذج: `eleven_multilingual_v2` (يدعم العربية)
  - المفاتيح: `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_MALE` + `ELEVENLABS_VOICE_FEMALE`

### بيئة التطوير (الكودسبيس)
- GitHub Codespace اسمه «supreme guacamole» (الفرع main).
- الوصول: من Termux (جوال) عبر `gh codespace ssh` ← اختر supreme guacamole ← `tmux attach -t work`.
- أو من الكمبيوتر مباشرة عبر codespace في المتصفّح/VSCode.
- **مع Claude Code: يعمل داخل الكودسبيس مباشرة** — لا حاجة للرفع اليدوي.
- توكن Supabase (`SUPABASE_ACCESS_TOKEN` يبدأ `sbp_`) لا يبقى بين الجلسات — يُعاد تصديره كل جلسة لنشر الدوال.

---

## ٦. قاعدة البيانات (مبنية وتعمل — لا تُعِد بناءها)

### جداول المحتوى (قراءة عامّة)
- `stages` (المراحل)، `grades` (الصفوف ١-٣ — قاعدة البيانات تحوي أصلًا ثلاثة صفوف فقط: الأول والثاني والثالث)، `subjects` (المواد)، `lessons` (الدروس: id, title, content_text, status, subject_id, grade_id).

### جداول الحساب العائلي
- `parents` (id→auth.users, full_name, parent_pin, plan)
- `children` (id, parent_id, name, avatar, grade_id, points, game_minutes)
- `quiz_results`, `subscriptions`

### جداول الاقتصاد
- `streaks` (current_streak, longest_streak, last_active_date, weather: thriving/cloudy)
- `pets_catalog`, `world_items_catalog` (asset_url لا emoji)
- `child_pets`, `child_world_items`, `gem_transactions`, `family_challenges`

### Views
- `child_analytics` (تجميع إحصائي لكل طفل، security_invoker=true)

### قواعد RLS/GRANT (دروس مكلفة — مطبّقة)
- جداول المحتوى: `GRANT SELECT TO anon, authenticated` + سياسة `for select using (true)`.
- جداول الحساب: `GRANT ... TO authenticated` + سياسات منفصلة لكل عملية **مع WITH CHECK للإدراج** (سياسة `ALL USING` بلا WITH CHECK تمنع الإدراج صامتًا — درس مكلف).
- تأكيد البريد (Confirm email) **معطّل** في Supabase Auth (وإلّا لا يكتمل التسجيل ولا يُنشأ سجلّ الوالد).

### بيانات موجودة
- مرحلة ابتدائية + صفوف ١-٣ (قاعدة البيانات تحوي أصلًا ثلاثة صفوف فقط) + مادة الرياضيات + درس «مقدمة في الضرب» (status=processed).
- **ناقص**: دروس كثيرة (درس واحد فقp يجعل كل المحطات تؤدي لنفس المحتوى).

---

## ٧. الدوال (Edge Functions)

### منشورة وتعمل
- `explain-lesson`: تشرH درسًا عبر Claude (نسخة Anthropic، claude-haiku-4-5). **مختبرة وتعمل**.
- `tutor-chat`: **عقل المعلّم الحواري الجديد**. **منشورة ومختبرة فعليًّا** (نُشرت عبر لوحة Supabase في المتصفّح، ٢٠٢٦-٠٦-٢٨). تستقبل سجلّ المحادثة + ردّ الطفل، تحلّل الفهم، تقرّر مسار حكيم دون صح/خطأ، تُرجع: reply, understanding, concept, lessonComplete, suggestChips. اختُبرت بحوار حقيقي ٤ جولات: تبدأ الحوار، وعند خطأ الطفل تعيد الشرح بزاوية أبسط (understanding=needs_review) بلا أي «خطأ»، وعند الصواب تشجّع وتتقدّم (understanding=good).
- `tts`: **النطق الصوتي لحكيم** عبر ElevenLabs. **منشورة ومختبرة فعليًّا** (٢٠٢٦-٠٦-٢٨). تستقبل `{ text, gender }` وتُرجع صوت `audio/mpeg` (MP3). النموذج `eleven_multilingual_v2` (يدعم العربية). تختار الصوت حسب الجنس: `male` (افتراضي — حكيم) أو `female`. اختُبر المساران بنصّ عربي قصير وأرجعا ملفّي MP3 صالحين (رمز ٢٠٠). **يتطلّب اشتراك ElevenLabs مدفوعًا** (الحساب المجّاني لا يستخدم أصوات المكتبة عبر الـAPI — درس: خطأ `payment_required`). الأسرار المطلوبة في Secrets: `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_MALE` (`t9akNmCDhz230CEXOYmn`) + `ELEVENLABS_VOICE_FEMALE` (`kdUY91gH5xyDHapxlthT`) — **مضبوطة فعليًّا**.

### مكتوبة غير منشورة
- `process-file`: استخراج نصّ مناهج PDF (unpdf). تحتاج SUPABASE_URL + SERVICE_ROLE_KEY.
- `youtube-search`: بحث فيديو آمن. **مؤجّلة** (لا مفتاH يوتيوب).

### سياق نشر الدوال
```
export SUPABASE_ACCESS_TOKEN=sbp_...   # كل جلسة
supabase link --project-ref lzfgjvafmvofwjiyvelq   # مرة
supabase functions deploy <name>        # بلا --project-ref بعد link
```
**تنبيه**: لا تستخدم `--project-ref` مع `secrets set` بعد link (يعطي خطأ). 
**تنبيه**: مجلّد دالة فارغ (بلا index.ts) يكسر `functions deploy` — احذف أي مجلّد دالة فارغ.

---

## ٨. حالة الكود الحالية (ما هو مبنيّ)

### مبنيّ ويعمل (في app/ core/ config/ components/)
- **الأساس**: `app/_layout.tsx`, `app/index.tsx` (بوّابة), `core/supabase.ts` (عميل + أنواع), `config/theme.ts` (برتقالي), `config/assets.ts` (مرن), `config/ageProfiles.ts` (تكيّف عمري ٣ فئات).
- **المصادقة والحساب**: `core/auth.ts`, `core/children.ts`, `app/(auth)/login.tsx`, `app/(auth)/setup-children.tsx`, `app/profiles.tsx`.
- **تجربة الطفل**: `app/(child)/_layout.tsx` (تبويبات), `world.tsx` (كوكب+متجر+تحدٍّ), `journey.tsx` (خريطة), `lesson.tsx`, `quiz.tsx`, `reward.tsx`, `parent-link.tsx`.
- **المكوّنات**: `Hakeem.tsx` (بديل متدرّج), `PlanetCanvas.tsx` (Skia), `JourneyMap.tsx` (Skia), `AssetImage.tsx` (عرض مرن).
- **المنطq**: `economy.ts`, `streaks.ts`, `challenge.ts`, `ai.ts`.
- **لوحة الأب**: `app/(parent)/_layout.tsx`, `pin.tsx`, `dashboard.tsx`.

### يحتاج إعادة بناء (قلب الفكرة)
- **`lesson.tsx`**: حاليًّا شرH ثابت + زر اختبار. يجب تحويله لـ**شاشة حوار صوتية**: حكيم ينطق (expo-speech)، يستمع (expo-speech-recognition)، الطفل يكتب أيضًا، يستدعي `tutor-chat`، حوار متعدّد الجولات.
- **`quiz.tsx` و `reward.tsx`**: يجب استبدال الاختبار بـ**لعبة Skia حقيقية** (التقاط فواكه) تمنح جواهر.

### الأصول الفنية (ناقصة — التطبيq يعمل ببدائل متدرّجة)
- مرجع كامل في `ASSET_MANIFEST.md`: حكيم (Lottie)، حيوانات (PNG)، مقتنيات، أيقونة.

---

## ٩. خريطة الطريq (بالترتيب الصارم)

**المرحلة الحالية: إعادة بناء قلب الفكرة**
1. **المعلّم الحواري**: ✅ نشر `tutor-chat` واختبارها (تمّ ٢٠٢٦-٠٦-٢٨). **التالي**: إعادة بناء `lesson.tsx` كشاشة حوار صوتية (حكيم ينطق عبر expo-speech، يستمع عبر expo-speech-recognition، الطفل يكتب أيضًا، تستدعي `tutor-chat`).
2. **لعبة المكافأة**: لعبة Skia (التقاط فواكه) في `reward.tsx`، مرتبطة بالجواهر.
3. **الربp**: نجاH الحوار يفتH اللعبة، اللعبة تمنH جواهر تطوّر الكوكب.

**بعد إتقان القلب:**
4. إثراء المحتوى (دروس كثيرة بدل واحد).
5. لوحة الأب (توصيات ذكية + هدايا فورية عبر Realtime).
6. لوحة المالك (Remote Config + تحليلات + نمو فيروسي).
7. الأصول الفنية + البناء النهائي.

---

## ١٠. أخطاء مكلفة سابقة (لا تكرّرها)

- مفتاH `sk-ant-` هو Anthropic لا OpenAI — كل الدوال تستخdم Anthropic API.
- سياسة RLS `ALL USING(...)` بلا `WITH CHECK` تمنع الإدراج صامتًا.
- `GRANT SELECT` ضروري للأدوار (anon/authenticated) — RLS وحده لا يكفي.
- تأكيد البريد المفعّل يمنع إنشاء سجلّ الوالد عند التسجيل.
- مجلّد دالة فارغ يكسر `supabase functions deploy`.
- `require` ثابت لأصل غير موجود يكسر بناء Metro — استخدم البدائل المرنة.
- إضافة plugin في app.json غير مثبّتة في node_modules تكسر البناء.
- لا تكتب عربيًّا في `eas update --message` (يتلف RTL في الطرفية).
- فحص توازن الأقواس اليدوي يخطئ مع النصوص العربية — استخدم `tsc --noEmit` للتحقّ.
- `git add -A` قد يلتقp بقايا قديمة متسرّبة — انتبه لما يُضاف قبل commit.

---

## ١١. كيف نعمل مع Claude Code

- Claude Code يعمل **داخل الكودسبيس مباشرة**: يقرأ الملفات، يعدّلها، يشغّل الأوامر، ينشر الدوال — بلا رفع يدوي.
- المالك يوافq على الخطوات المهمة، لكن Claude Code ينفّذ التفاصيل التقنية بنفسه.
- ابدأ كل جلسة بقراءة هذا الملف (CLAUDE.md) + فحص حالة المستودع الفعلية.
- بعد كل إنجاز مهم، حدّث هذا الملف.
