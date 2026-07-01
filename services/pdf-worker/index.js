// services/pdf-worker/index.js
// Async job pattern for Mizan PDF processing (beats Render 100s load balancer limit)
// POST /process-book returns immediately with job_id, processing happens in background

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ═══ Environment variables ═══
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const INGEST_VISION_URL = process.env.INGEST_VISION_URL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PORT = process.env.PORT || 10000;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY || !INGEST_VISION_URL) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('  - SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  if (!GEMINI_API_KEY) console.error('  - GEMINI_API_KEY');
  if (!INGEST_VISION_URL) console.error('  - INGEST_VISION_URL');
  process.exit(1);
}

// Supabase client with ws transport for Node.js 20+ realtime compatibility
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws,
  },
});

// ═══ Constants ═══
const GEMINI_MODEL = 'gemini-2.5-flash';
const RENDER_DENSITY = 150; // Full quality for uploaded images
const CONVERT_CHUNK = 3; // Reduced to 3 for memory efficiency (streamed delete)
const DETECT_DENSITY = 50; // Low DPI for chapter detection
const DETECT_JPEG_QUALITY = 40; // Compressed detection images
const DETECT_BATCH = 15; // Pages per Gemini detection call

// ═══ Book status / reconciliation ═══
const SUPABASE_REST = `${SUPABASE_URL}/rest/v1`;
const bookHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};
const MAX_RECONCILE_ATTEMPTS = 15;
const RECONCILE_TOKEN = process.env.RECONCILE_TOKEN || '';

// ═══ Express app ═══
const app = express();

// CORS configuration (before routes)
const corsOptions = {
  origin: ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN.split(','),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parser for JSON
app.use(express.json());

// Multer upload config (store in temp with job_id subdirectory)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const jobId = req.body.job_id || Date.now().toString();
      const jobDir = path.join(os.tmpdir(), 'jobs', jobId);
      fs.mkdirSync(jobDir, { recursive: true });
      req.jobDir = jobDir; // Store for later use
      cb(null, jobDir);
    },
    filename: (req, file, cb) => {
      cb(null, 'book.pdf');
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// Get PDF page count using pdfinfo
function getPdfPageCount(pdfPath) {
  try {
    const output = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
    const match = output.match(/Pages:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (err) {
    throw new Error(`Failed to get PDF page count: ${err.message}`);
  }
}

// Update job status in database
async function updateJob(jobId, updates) {
  const { error } = await supabase
    .from('ingestion_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    console.error(`⚠️ Failed to update job ${jobId}:`, error.message);
  }
}

// Convert PDF pages to images (streamed: convert → upload → compress for detection → delete)
// Returns: { uploadedPages: [{pageNum, imageUrl}], detectionImages: [{pageNum, buffer}] }
async function convertAndUploadPages(pdfPath, totalPages, bookSlug, jobId) {
  console.log(`📄 Converting & uploading PDF: ${totalPages} pages (chunk size: ${CONVERT_CHUNK})`);

  const uploadedPages = [];
  const detectionImages = []; // Compressed images kept in memory for detection

  for (let from = 1; from <= totalPages; from += CONVERT_CHUNK) {
    const to = Math.min(from + CONVERT_CHUNK - 1, totalPages);
    await updateJob(jobId, {
      status: 'converting',
      current_step: `Converting & uploading pages ${from}-${to}...`,
    });
    console.log(`  Batch ${from}-${to}: converting...`);

    const converter = fromPath(pdfPath, {
      density: RENDER_DENSITY,
      saveFilename: 'page',
      savePath: path.dirname(pdfPath),
      format: 'png',
      preserveAspectRatio: true,
    });

    // Convert each page individually
    for (let pageNum = from; pageNum <= to; pageNum++) {
      try {
        const result = await converter(pageNum, { responseType: 'buffer' });

        // Extract buffer (handle different pdf2pic versions)
        let buffer = null;
        if (result && result.buffer) buffer = result.buffer;
        else if (result && result.base64) buffer = Buffer.from(result.base64, 'base64');
        else if (Buffer.isBuffer(result)) buffer = result;

        if (!buffer) {
          console.error(`    ✗ Page ${pageNum}: empty buffer (conversion failed)`);
          continue;
        }

        const nnn = String(pageNum).padStart(3, '0');
        const filename = `page-${nnn}.png`;

        // (1) Upload full-quality image to Supabase Storage
        // FIXED: storagePath without 'lesson_pages/' prefix (bucket name provides it)
        const storagePath = `${bookSlug}/${filename}`;
        const { error: uploadErr } = await supabase.storage
          .from('lesson_pages')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (uploadErr) {
          console.error(`    ✗ Page ${pageNum} upload FAILED: ${uploadErr.message}`);
          continue;
        }

        // FIXED: imageUrl with correct path (no duplicate lesson_pages/)
        const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/lesson_pages/${bookSlug}/${filename}`;
        uploadedPages.push({ pageNum, imageUrl });

        // (2) Create compressed version for detection (only after successful upload)
        // FIXED: moved after upload check to prevent mismatch
        const compressedBuffer = await sharp(buffer)
          .resize({ width: 600 })
          .jpeg({ quality: DETECT_JPEG_QUALITY })
          .toBuffer();

        detectionImages.push({ pageNum, buffer: compressedBuffer });

        console.log(`    ✓ Page ${pageNum}: uploaded successfully + compressed for detection`);
      } catch (err) {
        console.error(`    ✗ Page ${pageNum} processing FAILED: ${err.message}`);
      }
    }

    // Update progress
    await updateJob(jobId, { pages_uploaded: uploadedPages.length });
  }

  console.log(`✅ Upload complete: ${uploadedPages.length}/${totalPages} pages`);

  // FIXED: Fail fast if no pages uploaded (prevents silent failure)
  if (uploadedPages.length === 0) {
    throw new Error(
      `Upload failed: 0/${totalPages} pages uploaded. Check storage bucket configuration, ` +
      `service_role_key permissions, and network connectivity.`
    );
  }

  return { uploadedPages, detectionImages };
}

// Detect chapters using compressed images (batched Gemini calls)
async function detectChapters(detectionImages, totalPages, jobId) {
  console.log(`🔍 Detecting chapters from ${totalPages} pages (batch size: ${DETECT_BATCH})...`);
  await updateJob(jobId, {
    status: 'detecting',
    current_step: 'Analyzing page images to detect chapters...',
  });

  const allChapters = [];

  for (let i = 0; i < detectionImages.length; i += DETECT_BATCH) {
    const batch = detectionImages.slice(i, i + DETECT_BATCH);
    const startPage = batch[0].pageNum;
    const endPage = batch[batch.length - 1].pageNum;

    console.log(`  Analyzing batch pages ${startPage}-${endPage}...`);
    await updateJob(jobId, { current_step: `Analyzing pages ${startPage}-${endPage}...` });

    const parts = [];
    for (const { pageNum, buffer } of batch) {
      const base64 = buffer.toString('base64');
      parts.push({ text: `صورة الصفحة ${pageNum}:` });
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      });
    }

    const systemPrompt = `أنت محلّل كتب مدرسية سعودية. مهمتك: تحليل صور صفحات كتاب (مرتّبة) واستخراج بنية الفصول والدروس.

قواعد:
- كل فصل له ترويسة واضحة (الفصل ١، ٢، ...)
- كل درس له عنوان في رأس صفحاته (عادة عريض/ملوّن)
- رقم الصفحة في أسفل الصفحة (تجاهله — استخدم "صورة الصفحة N" المُرسل)
- قد توجد صفحات تمهيدية/غلاف/اختبارات (item_type='intro' أو 'test_mid' أو 'test_chapter' أو 'other')

أرجع JSON array، كل عنصر:
{
  "item_type": "lesson" | "test_mid" | "test_chapter" | "test_cumulative" | "intro" | "cover" | "teacher" | "other",
  "chapter_number": رقم الفصل (int، أو null إن غير منطبق),
  "chapter_title": عنوان الفصل (string),
  "lesson_title": عنوان الدرس (كامل — لا تقص أرقاماً جزء من العنوان مثل "الأعداد ١٨، ١٩، ٢٠"),
  "page_start": أول صفحة,
  "page_end": آخر صفحة,
  "full_text": "" (فارغ — لا نحتاج نص هنا)
}

مثال (خيالي): صفحات 1-2 غلاف، 3-8 فصل ١ درس أول، 9-12 فصل ١ درس ثاني، 13 اختبار الفصل.
[
  {"item_type":"cover","chapter_number":null,"chapter_title":"","lesson_title":"","page_start":1,"page_end":2,"full_text":""},
  {"item_type":"lesson","chapter_number":1,"chapter_title":"الأعداد","lesson_title":"العد حتى ١٠","page_start":3,"page_end":8,"full_text":""},
  {"item_type":"lesson","chapter_number":1,"chapter_title":"الأعداد","lesson_title":"مقارنة الأعداد","page_start":9,"page_end":12,"full_text":""},
  {"item_type":"test_chapter","chapter_number":1,"chapter_title":"الأعداد","lesson_title":"اختبار الفصل ١","page_start":13,"page_end":13,"full_text":""}
]`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 16384,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_type: {
                      type: 'string',
                      enum: ['lesson', 'test_mid', 'test_chapter', 'test_cumulative', 'intro', 'cover', 'teacher', 'other'],
                    },
                    chapter_number: { type: 'integer', nullable: true },
                    chapter_title: { type: 'string' },
                    lesson_title: { type: 'string' },
                    page_start: { type: 'integer' },
                    page_end: { type: 'integer' },
                    full_text: { type: 'string' },
                  },
                  required: ['item_type', 'page_start', 'page_end', 'full_text'],
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (text) {
        const items = JSON.parse(text);
        // Filter to lessons only
        const lessons = items.filter((item) => item.item_type === 'lesson');
        allChapters.push(...lessons);
        console.log(`    ✓ Found ${lessons.length} lessons in this batch`);
      }
    } catch (err) {
      console.error(`  ⚠️ Detection failed for batch ${startPage}-${endPage}: ${err.message}`);
    }
  }

  console.log(`✅ Detected ${allChapters.length} total chapters/lessons`);
  return allChapters;
}

// Process single chapter via ingest-vision (with retry and 503-aware backoff)
async function processChapter(payload, retries = 4) {
  const { chapter_number, page_from, page_to } = payload;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  🔄 Processing Chapter ${chapter_number} (pages ${page_from}-${page_to}), attempt ${attempt}/${retries}...`);

      const response = await fetch(INGEST_VISION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ingest-vision error: ${response.status} ${errText}`);
      }

      const result = await response.json();

      // FIXED: Support new contract (committed, summary) and legacy (ok, lessons_written)
      const success = result.committed === true || result.ok === true;
      const lessonsWritten = result.summary?.lessons_written ?? result.lessons_written ?? 0;
      const chunksWritten = result.summary?.chunks_written ?? result.chunks_written ?? 0;

      if (success && lessonsWritten > 0) {
        console.log(`    ✅ Chapter ${chapter_number}: ${lessonsWritten} lessons, ${chunksWritten} chunks`);
        return {
          ok: true,
          chapter_number,
          lessons_written: lessonsWritten,
          chunks_written: chunksWritten,
        };
      } else {
        const failedItems = result.items?.filter((it) => it && it.ok === false) || [];
        const errorMsg =
          result.error ||
          (failedItems.length
            ? `عناصر فشلت: ${failedItems.map((it) => it.error).join('; ')}`
            : `لم تُكتب دروس (committed=${result.committed}, lessons=${lessonsWritten})`);
        throw new Error(errorMsg);
      }
    } catch (err) {
      console.error(`    ⚠️ Attempt ${attempt} failed: ${err.message}`);

      if (attempt < retries) {
        // FIXED: 503-aware backoff (Gemini overload needs longer delays)
        const errMsg = err.message.toLowerCase();
        const is503 =
          errMsg.includes('503') ||
          errMsg.includes('overload') ||
          errMsg.includes('high demand') ||
          errMsg.includes('unavailable');
        const delays503 = [15000, 45000, 90000]; // 15s, 45s, 90s for Gemini overload
        const delaysNormal = [1000, 3000, 6000]; // 1s, 3s, 6s for other errors
        const delayArray = is503 ? delays503 : delaysNormal;
        const delay = delayArray[attempt - 1] || (is503 ? 90000 : 6000);
        console.log(`    ⏳ Retrying in ${delay}ms... (503: ${is503})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`    ❌ Chapter ${chapter_number} failed after ${retries} attempts`);
        return {
          ok: false,
          chapter_number,
          error: err.message,
        };
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ASYNC BACKGROUND PROCESSING
// ═══════════════════════════════════════════════════════════════

async function processBookAsync(jobId, pdfPath, meta) {
  const { subject_id, grade_id, part_number, book_slug } = meta;

  try {
    console.log(`🚀 [Job ${jobId}] Starting async processing: ${book_slug}`);

    // (1) Get total pages
    const totalPages = getPdfPageCount(pdfPath);
    if (totalPages === 0) {
      throw new Error('Failed to detect PDF page count');
    }

    console.log(`📊 [Job ${jobId}] Total pages: ${totalPages}`);
    await updateJob(jobId, { total_pages: totalPages });

    // (2) Convert PDF → upload images → create detection images (streamed)
    const { uploadedPages, detectionImages } = await convertAndUploadPages(
      pdfPath,
      totalPages,
      book_slug,
      jobId
    );

    if (uploadedPages.length === 0) {
      throw new Error('Failed to convert any pages');
    }

    // (3) Detect chapters using compressed images
    const chapters = await detectChapters(detectionImages, totalPages, jobId);

    if (chapters.length === 0) {
      throw new Error('No chapters detected');
    }

    await updateJob(jobId, { chapters_total: chapters.length });

    // (4) Process chapters sequentially
    console.log(`🔄 [Job ${jobId}] Processing ${chapters.length} chapters sequentially...`);
    await updateJob(jobId, {
      status: 'processing',
      current_step: 'Processing chapters via ingest-vision...',
    });

    const results = [];
    const failedChapters = [];

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const chapterNum = i + 1; // Sequential numbering

      await updateJob(jobId, {
        current_step: `Processing Chapter ${chapterNum}: "${chapter.lesson_title}" (pages ${chapter.page_start}-${chapter.page_end})...`,
      });

      const payload = {
        subject_id,
        grade_id,
        part_number,
        book_slug,
        page_from: chapter.page_start,
        page_to: chapter.page_end,
        mode: 'commit',
        chapter_number: chapterNum, // Override Gemini's detection
      };

      const result = await processChapter(payload);
      results.push(result);

      if (result.ok) {
        await updateJob(jobId, { chapters_done: i + 1 });
      } else {
        failedChapters.push({
          chapter_number: chapterNum,
          page_start: chapter.page_start,
          page_end: chapter.page_end,
          error: result.error,
        });
      }
    }

    // (5) Page gaps (informational only)
    const gaps = [];
    const sortedChapters = [...chapters].sort((a, b) => a.page_start - b.page_start); // copy, no mutation

    for (let i = 0; i < sortedChapters.length - 1; i++) {
      const currentEnd = sortedChapters[i].page_end;
      const nextStart = sortedChapters[i + 1].page_start;

      if (nextStart - currentEnd > 1) {
        gaps.push({
          page_from: currentEnd + 1,
          page_to: nextStart - 1,
        });
      }
    }

    // (6) Locked desired state + page-based coverage (reconciliation model).
    // Desired state = detected lessons keyed by page_start. Locked on first ingest so it
    // never drifts across repeated 503 retries — this guarantees convergence.
    const detectedLessons = chapters.map((ch, i) => ({
      page_start: ch.page_start,
      page_end: ch.page_end,
      chapter_number: i + 1,
      title: ch.lesson_title || ch.chapter_title || '',
    }));

    // (6a) Read (or create) the locked book_status row. Never overwrite detected_lessons.
    let lockedDetected = detectedLessons;
    try {
      const statusRes = await fetch(
        `${SUPABASE_REST}/book_status?subject_id=eq.${subject_id}&part_number=eq.${part_number}&select=detected_lessons`,
        { headers: bookHeaders }
      );
      const statusRows = statusRes.ok ? await statusRes.json() : [];

      if (!statusRows.length) {
        // First ingest → create the locked desired state.
        await fetch(`${SUPABASE_REST}/book_status`, {
          method: 'POST',
          headers: bookHeaders,
          body: JSON.stringify({
            subject_id,
            grade_id,
            part_number,
            book_slug,
            detected_lessons: detectedLessons,
            total_lessons_detected: detectedLessons.length,
            status: 'processing',
          }),
        });
        lockedDetected = detectedLessons;
      } else {
        // Already locked → keep the original desired state (ensures convergence).
        lockedDetected = statusRows[0].detected_lessons || detectedLessons;
      }
    } catch (statusErr) {
      console.error(`   ⚠️ book_status lock read/create failed: ${statusErr.message}`);
    }

    // (6b) Page-based coverage: which desired page_starts already exist in lessons?
    let writtenSet = new Set();
    try {
      const writtenRes = await fetch(
        `${SUPABASE_REST}/lessons?subject_id=eq.${subject_id}&part_number=eq.${part_number}&select=page_start`,
        { headers: bookHeaders }
      );
      const writtenRows = writtenRes.ok ? await writtenRes.json() : [];
      writtenSet = new Set(writtenRows.map((r) => r.page_start));
    } catch (writtenErr) {
      console.error(`   ⚠️ Failed to read written lessons: ${writtenErr.message}`);
    }

    const missingLessons = lockedDetected.filter((l) => !writtenSet.has(l.page_start));
    const coverageComplete = missingLessons.length === 0;
    const lessonsWritten = lockedDetected.length - missingLessons.length;

    console.log(
      `🔍 [Job ${jobId}] Page-based coverage: ${lessonsWritten}/${lockedDetected.length} written, ` +
      `${missingLessons.length} missing, complete=${coverageComplete}`
    );

    // (6c) Update book_status — never touch detected_lessons (the lock).
    try {
      await fetch(
        `${SUPABASE_REST}/book_status?subject_id=eq.${subject_id}&part_number=eq.${part_number}`,
        {
          method: 'PATCH',
          headers: bookHeaders,
          body: JSON.stringify({
            lessons_written: lessonsWritten,
            missing_lessons: missingLessons,
            coverage_complete: coverageComplete,
            status: coverageComplete ? 'complete' : 'processing',
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        }
      );
    } catch (patchErr) {
      console.error(`   ⚠️ book_status PATCH failed: ${patchErr.message}`);
    }

    // (7) Final job result (honest, page-based).
    const finalResult = {
      book_slug,
      total_pages: totalPages,
      pages_uploaded: uploadedPages.length,
      lessons_detected: lockedDetected.length,
      lessons_written: lessonsWritten,
      missing_lessons: missingLessons,
      coverage_complete: coverageComplete,
      chapters: results, // per-chapter attempt results
      gaps, // page gaps (informational)
      failed_chapters: failedChapters, // informational
    };

    // (8) Honest job status: done if complete OR partial; failed only if nothing written.
    const finalStatus = coverageComplete ? 'done' : (lessonsWritten > 0 ? 'done' : 'failed');

    console.log(`✅ [Job ${jobId}] Book processing ${finalStatus}: ${book_slug}`);
    console.log(`   - Lessons written (DB, page-based): ${lessonsWritten}/${lockedDetected.length}`);
    console.log(`   - Missing lessons: ${missingLessons.length}`);
    console.log(`   - Coverage complete: ${coverageComplete}`);
    console.log(`   - Page gaps: ${gaps.length}`);

    await updateJob(jobId, {
      status: finalStatus,
      current_step: coverageComplete ? 'Processing complete' : `Incomplete: ${missingLessons.length} lessons missing`,
      chapters_done: lessonsWritten,
      result: finalResult,
    });
  } catch (err) {
    console.error(`❌ [Job ${jobId}] Fatal error: ${err.message}`);
    await updateJob(jobId, {
      status: 'failed',
      error: err.message,
      current_step: 'Processing failed',
    });
  } finally {
    // Cleanup: delete job directory
    try {
      const jobDir = path.dirname(pdfPath);
      await fsPromises.rm(jobDir, { recursive: true, force: true });
      console.log(`🗑️ [Job ${jobId}] Cleaned up temp directory`);
    } catch (cleanupErr) {
      console.error(`⚠️ [Job ${jobId}] Cleanup failed: ${cleanupErr.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// POST /process-book - Create job and return immediately
app.post('/process-book', upload.single('file'), async (req, res) => {
  // Disable timeout for large file uploads
  req.setTimeout(0);
  res.setTimeout(0);

  try {
    const { subject_id, grade_id, part_number, book_slug } = req.body;

    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    if (!subject_id || !grade_id || !part_number || !book_slug) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: subject_id, grade_id, part_number, book_slug',
      });
    }

    const pdfPath = req.file.path;

    // Create job in database
    const { data: job, error: jobErr } = await supabase
      .from('ingestion_jobs')
      .insert({
        book_slug,
        subject_id,
        grade_id,
        part_number: parseInt(part_number, 10),
        status: 'queued',
      })
      .select()
      .single();

    if (jobErr || !job) {
      return res.status(500).json({ ok: false, error: 'Failed to create job', details: jobErr });
    }

    console.log(`📥 [Job ${job.id}] Created: ${book_slug} (${req.file.size} bytes)`);

    // Start async processing (non-blocking)
    setImmediate(() => {
      processBookAsync(job.id, pdfPath, {
        subject_id,
        grade_id,
        part_number: parseInt(part_number, 10),
        book_slug,
      });
    });

    // Return immediately (client polls /job/:id for status)
    res.json({
      ok: true,
      job_id: job.id,
      status: 'queued',
      message: 'Job created. Poll GET /job/:id for status.',
    });
  } catch (err) {
    console.error('Error in /process-book:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /job/:id - Poll job status
app.get('/job/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: job, error } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !job) {
      return res.status(404).json({ ok: false, error: 'Job not found' });
    }

    res.json({
      ok: true,
      job_id: job.id,
      book_slug: job.book_slug,
      status: job.status,
      total_pages: job.total_pages,
      pages_uploaded: job.pages_uploaded,
      chapters_total: job.chapters_total,
      chapters_done: job.chapters_done,
      current_step: job.current_step,
      error: job.error,
      result: job.result,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (err) {
    console.error('Error in /job/:id:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /jobs - List recent jobs (for admin panel)
app.get('/jobs', async (req, res) => {
  try {
    const { data: jobs, error } = await supabase
      .from('ingestion_jobs')
      .select('id, book_slug, status, total_pages, chapters_total, chapters_done, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    res.json({ ok: true, jobs });
  } catch (err) {
    console.error('Error in /jobs:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /retry - Retry failed chapters (kept for compatibility)
app.post('/retry', async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  try {
    const { subject_id, grade_id, part_number, book_slug, chapters } = req.body;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return res.status(400).json({ ok: false, error: 'Missing or empty chapters array' });
    }

    console.log(`🔄 Retrying ${chapters.length} chapters for ${book_slug}`);

    const results = [];
    let failedCount = 0;

    for (const chapter of chapters) {
      const { chapter_number, page_from, page_to } = chapter;

      const payload = {
        subject_id,
        grade_id,
        part_number,
        book_slug,
        page_from,
        page_to,
        mode: 'commit',
        chapter_number,
      };

      const result = await processChapter(payload);
      results.push(result);

      if (!result.ok) {
        failedCount++;
      }
    }

    res.json({
      ok: true,
      book_slug,
      results,
      failed: failedCount,
    });
  } catch (err) {
    console.error('Error in /retry:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /reconcile - Self-healer: drive every incomplete book to its locked desired state.
// Body (optional) { subject_id, part_number } → single book; otherwise all incomplete books.
app.post('/reconcile', async (req, res) => {
  // Optional shared-secret guard (set RECONCILE_TOKEN in env to enable).
  if (RECONCILE_TOKEN && req.get('x-reconcile-token') !== RECONCILE_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  req.setTimeout(0);
  res.setTimeout(0);

  // Read the set of written page_starts for one book.
  async function readWrittenSet(subjectId, partNumber) {
    const r = await fetch(
      `${SUPABASE_REST}/lessons?subject_id=eq.${subjectId}&part_number=eq.${partNumber}&select=page_start`,
      { headers: bookHeaders }
    );
    const rows = r.ok ? await r.json() : [];
    return new Set(rows.map((x) => x.page_start));
  }

  try {
    const body = req.body || {};

    // (1) Pick target books.
    let books = [];
    if (body.subject_id && body.part_number != null) {
      const oneRes = await fetch(
        `${SUPABASE_REST}/book_status?subject_id=eq.${body.subject_id}&part_number=eq.${body.part_number}&select=*`,
        { headers: bookHeaders }
      );
      books = oneRes.ok ? await oneRes.json() : [];
    } else {
      const allRes = await fetch(
        `${SUPABASE_REST}/book_status?coverage_complete=eq.false&status=neq.needs_attention&select=*`,
        { headers: bookHeaders }
      );
      books = allRes.ok ? await allRes.json() : [];
    }

    const completed = [];
    const stillIncomplete = [];
    const needsAttention = [];

    // (2) Reconcile each book toward its locked desired state.
    for (const book of books) {
      const lockedDetected = book.detected_lessons || [];
      const now = () => new Date().toISOString();

      let writtenSet = await readWrittenSet(book.subject_id, book.part_number);
      const missing = lockedDetected.filter((l) => !writtenSet.has(l.page_start));

      // Already complete → mark and move on.
      if (missing.length === 0) {
        await fetch(
          `${SUPABASE_REST}/book_status?subject_id=eq.${book.subject_id}&part_number=eq.${book.part_number}`,
          {
            method: 'PATCH',
            headers: bookHeaders,
            body: JSON.stringify({
              coverage_complete: true,
              status: 'complete',
              lessons_written: lockedDetected.length,
              missing_lessons: [],
              last_checked_at: now(),
              updated_at: now(),
            }),
          }
        );
        completed.push({ subject_id: book.subject_id, part_number: book.part_number, book_slug: book.book_slug });
        continue;
      }

      // Reprocess each missing lesson (ingest-vision UPSERT is idempotent).
      for (const l of missing) {
        await processChapter({
          subject_id: book.subject_id,
          grade_id: book.grade_id,
          part_number: book.part_number,
          book_slug: book.book_slug,
          page_from: l.page_start,
          page_to: l.page_end,
          mode: 'commit',
          chapter_number: l.chapter_number,
        });
      }

      // Re-read and recompute coverage.
      writtenSet = await readWrittenSet(book.subject_id, book.part_number);
      const missing2 = lockedDetected.filter((l) => !writtenSet.has(l.page_start));
      const coverageComplete2 = missing2.length === 0;
      const lessonsWritten2 = lockedDetected.length - missing2.length;
      const attempts2 = (book.reconcile_attempts || 0) + 1;
      const newStatus = coverageComplete2
        ? 'complete'
        : (attempts2 >= MAX_RECONCILE_ATTEMPTS ? 'needs_attention' : 'processing');

      await fetch(
        `${SUPABASE_REST}/book_status?subject_id=eq.${book.subject_id}&part_number=eq.${book.part_number}`,
        {
          method: 'PATCH',
          headers: bookHeaders,
          body: JSON.stringify({
            lessons_written: lessonsWritten2,
            missing_lessons: missing2,
            coverage_complete: coverageComplete2,
            reconcile_attempts: attempts2,
            status: newStatus,
            last_checked_at: now(),
            updated_at: now(),
          }),
        }
      );

      const entry = {
        subject_id: book.subject_id,
        part_number: book.part_number,
        book_slug: book.book_slug,
        lessons_written: lessonsWritten2,
        missing: missing2.length,
        attempts: attempts2,
      };
      if (coverageComplete2) completed.push(entry);
      else if (newStatus === 'needs_attention') needsAttention.push(entry);
      else stillIncomplete.push(entry);
    }

    res.json({
      ok: true,
      books_processed: books.length,
      completed,
      still_incomplete: stillIncomplete,
      needs_attention: needsAttention,
    });
  } catch (err) {
    console.error('Error in /reconcile:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══ Start server ═══
app.listen(PORT, () => {
  console.log(`✅ Mizan PDF Worker running on port ${PORT}`);
  console.log(`   - Health: GET /health`);
  console.log(`   - Process: POST /process-book (returns job_id immediately)`);
  console.log(`   - Poll: GET /job/:id`);
  console.log(`   - List: GET /jobs`);
  console.log(`   - Retry: POST /retry`);
  console.log(`   - Reconcile: POST /reconcile (self-healer → locked desired state)`);
});
