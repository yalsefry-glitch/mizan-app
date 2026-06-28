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

### مفتاH الذكاء (مهم جدًّا — درس مكلف)
- المالك يملك **مفتاH Anthropic (Claude)** يبدأ بـ`sk-ant-api03-`. **ليس OpenAI.**
- مخزّن في Supabase Secrets باسم `OPENAI_KEY` (الاسم مضلّل لكنه يحوي مفتاH Anthropic).
- كل دوال الذكاء تتّصل بـ**Anthropic Messages API** (`https://api.anthropic.com/v1/messages`)، رأس `x-api-key`، نموذج **`claude-haiku-4-5`**.
- **لا تستخدم OpenAI إطلاقًا** — المالك لا يملك مفتاH OpenAI صالحًا (يملك حساب ChatGPT فقp، لا API).

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
