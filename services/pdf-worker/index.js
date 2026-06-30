// services/pdf-worker/index.js
// Hardened PDF processing worker for Mizan book ingestion on Render.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { fromPath } = require('pdf2pic');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
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

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ═══ Constants ═══
const GEMINI_MODEL = 'gemini-2.5-flash';
const RENDER_DENSITY = 150;
const CONVERT_CHUNK = 5;
const DETECT_DENSITY = 50;
const DETECT_JPEG_QUALITY = 40;
const DETECT_BATCH = 15;

// ═══ Express app ═══
const app = express();

// CORS configuration (before routes)
const corsOptions = {
  origin: ALLOWED_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());

// Multer configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => {
      cb(null, `upload-${Date.now()}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ═══ Helper: Get PDF page count ═══
function getPdfPageCount(pdfPath) {
  try {
    const output = execSync(`pdfinfo "${pdfPath}"`, { encoding: 'utf8' });
    const match = output.match(/Pages:\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  } catch (err) {
    throw new Error(`Failed to get PDF page count: ${err.message}`);
  }
}

// ═══ CORE FUNCTION 1: Convert PDF to images (chunked to avoid OOM) ═══
async function convertPdfToImages(pdfPath, outDir, totalPages) {
  console.log(`📄 Converting PDF: ${totalPages} pages (chunk size: ${CONVERT_CHUNK})`);

  const pageFiles = [];

  for (let from = 1; from <= totalPages; from += CONVERT_CHUNK) {
    const to = Math.min(from + CONVERT_CHUNK - 1, totalPages);
    console.log(`  Converting batch ${from}-${to}...`);

    const converter = fromPath(pdfPath, {
      density: RENDER_DENSITY,
      saveFilename: 'page',
      savePath: outDir,
      format: 'png',
      preserveAspectRatio: true,
    });

    // Convert each page in this batch individually
    for (let pageNum = from; pageNum <= to; pageNum++) {
      try {
        const result = await converter(pageNum, { responseType: 'buffer' });

        // Rename to zero-padded format: page-001.png
        const nnn = String(pageNum).padStart(3, '0');
        const targetPath = path.join(outDir, `page-${nnn}.png`);

        // pdf2pic creates files like "page.1.png" - find and rename
        const files = await fsPromises.readdir(outDir);
        const generatedFile = files.find(f =>
          f.match(new RegExp(`page\\.${pageNum}\\.png`)) ||
          f.match(new RegExp(`page-${pageNum}\\.png`))
        );

        if (generatedFile) {
          await fsPromises.rename(
            path.join(outDir, generatedFile),
            targetPath
          );
        } else if (result && result.path) {
          // If pdf2pic returned a path directly
          await fsPromises.rename(result.path, targetPath);
        }

        if (fs.existsSync(targetPath)) {
          pageFiles.push({ pageNum, path: targetPath, filename: `page-${nnn}.png` });
        }
      } catch (err) {
        console.error(`  ⚠️ Failed to convert page ${pageNum}: ${err.message}`);
      }
    }
  }

  console.log(`✅ Converted ${pageFiles.length}/${totalPages} pages`);
  return { pageFiles: pageFiles.sort((a, b) => a.pageNum - b.pageNum), totalPages };
}

// ═══ Helper: Upload images to Supabase ═══
async function uploadImages(pageFiles, bookSlug) {
  console.log(`📤 Uploading ${pageFiles.length} images to lesson_pages/${bookSlug}...`);

  const failed = [];
  let uploaded = 0;

  for (const { pageNum, path: filePath, filename } of pageFiles) {
    try {
      const fileBuffer = await fsPromises.readFile(filePath);
      const remotePath = `${bookSlug}/${filename}`;

      const { error } = await supabase.storage
        .from('lesson_pages')
        .upload(remotePath, fileBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        failed.push({ pageNum, error: error.message });
        console.error(`  ⚠️ Failed to upload page ${pageNum}: ${error.message}`);
      } else {
        uploaded++;
      }
    } catch (err) {
      failed.push({ pageNum, error: err.message });
      console.error(`  ⚠️ Failed to upload page ${pageNum}: ${err.message}`);
    }
  }

  console.log(`✅ Uploaded ${uploaded}/${pageFiles.length} images`);
  return { uploaded, failed };
}

// ═══ CORE FUNCTION 2: Detect chapters via Gemini (compressed images + batches) ═══
async function detectChapters(pageFiles, totalPages) {
  console.log(`🔍 Detecting chapters from ${totalPages} pages (batch size: ${DETECT_BATCH})...`);

  const allChapters = [];

  // Process in batches to stay within Gemini limits
  for (let i = 0; i < pageFiles.length; i += DETECT_BATCH) {
    const batch = pageFiles.slice(i, i + DETECT_BATCH);
    const batchStart = batch[0].pageNum;
    const batchEnd = batch[batch.length - 1].pageNum;
    console.log(`  Analyzing batch pages ${batchStart}-${batchEnd}...`);

    // Create compressed detection images in memory
    const parts = [];
    for (const { pageNum, path: filePath } of batch) {
      try {
        const buffer = await sharp(filePath)
          .resize({ width: 600 })
          .jpeg({ quality: DETECT_JPEG_QUALITY })
          .toBuffer();

        const base64 = buffer.toString('base64');
        parts.push({ text: `صورة الصفحة ${pageNum}:` });
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64
          }
        });
      } catch (err) {
        console.error(`    ⚠️ Failed to compress page ${pageNum}: ${err.message}`);
      }
    }

    if (parts.length === 0) continue;

    // Call Gemini API
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts }],
            systemInstruction: {
              parts: [{
                text: `أنت محلل مناهج سعودية. سأعطيك صور صفحات كتاب بالترتيب (منخفضة الدقة، تكفي لاكتشاف ترويسات الفصول). مهمتك فقط: حدّد أي الصفحات بداية فصل جديد (صفحة عنوان فصل مثل "الفصل N"). أرجع مصفوفة JSON: لكل بداية فصل {chapter_number, chapter_title, page_start}. JSON نقي فقط.`
              }]
            },
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 4096,
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    chapter_number: { type: 'integer' },
                    chapter_title: { type: 'string' },
                    page_start: { type: 'integer' },
                  },
                  required: ['chapter_number', 'chapter_title', 'page_start'],
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean and parse JSON
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      }
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }

      const chapters = JSON.parse(cleaned);
      if (Array.isArray(chapters)) {
        allChapters.push(...chapters);
        console.log(`    Found ${chapters.length} chapter(s) in this batch`);
      }
    } catch (err) {
      console.error(`    ⚠️ Failed to detect chapters in batch: ${err.message}`);
    }
  }

  // Sort by page_start and remove duplicates
  const uniqueChapters = [];
  const seen = new Set();

  allChapters
    .sort((a, b) => a.page_start - b.page_start)
    .forEach(ch => {
      const key = `${ch.chapter_number}-${ch.page_start}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueChapters.push(ch);
      }
    });

  // Calculate page_end for each chapter
  const result = uniqueChapters.map((ch, idx) => ({
    chapter_number: ch.chapter_number,
    chapter_title: ch.chapter_title,
    page_start: ch.page_start,
    page_end: idx < uniqueChapters.length - 1
      ? uniqueChapters[idx + 1].page_start - 1
      : totalPages,
  }));

  // If first chapter doesn't start at page 1, include introductory pages
  if (result.length > 0 && result[0].page_start > 1) {
    result.unshift({
      chapter_number: 0,
      chapter_title: 'مقدمة الكتاب',
      page_start: 1,
      page_end: result[0].page_start - 1,
    });
  }

  console.log(`✅ Detected ${result.length} chapters`);
  return result;
}

// ═══ Helper: Process single chapter via ingest-vision ═══
async function processChapter(payload, retries = 3) {
  const { chapter_number, page_from, page_to } = payload;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(INGEST_VISION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      return {
        ok: true,
        chapter_number,
        lessons_written: data.summary?.lessons_written || 0,
        chunks_written: data.summary?.chunks_written || 0,
      };
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 2000; // 2s, 4s, 6s
        console.log(`  ⚠️ Attempt ${attempt} failed for chapter ${chapter_number}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return {
          ok: false,
          chapter_number,
          error: err.message,
        };
      }
    }
  }
}

// ═══ ROUTE: POST /process-book ═══
app.post('/process-book', upload.single('file'), async (req, res) => {
  // Disable timeout for long-running operations
  req.setTimeout(0);
  res.setTimeout(0);

  const { subject_id, grade_id, part_number, book_slug } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'PDF file is required' });
  }
  if (!subject_id || !part_number || !book_slug) {
    return res.status(400).json({
      error: 'Missing required fields: subject_id, part_number, book_slug'
    });
  }

  const pdfPath = req.file.path;
  const tmpDir = path.join(os.tmpdir(), `${book_slug}-${Date.now()}`);

  try {
    await fsPromises.mkdir(tmpDir, { recursive: true });
    console.log(`\n🚀 Processing book: ${book_slug}`);

    // 1. Get total pages
    const totalPages = getPdfPageCount(pdfPath);
    console.log(`📊 Total pages: ${totalPages}`);

    if (totalPages === 0) {
      throw new Error('Could not determine PDF page count');
    }

    // 2. Convert PDF to images (chunked)
    const { pageFiles } = await convertPdfToImages(pdfPath, tmpDir, totalPages);

    if (pageFiles.length === 0) {
      throw new Error('No pages were successfully converted');
    }

    // 3. Upload images to Supabase
    const { uploaded, failed } = await uploadImages(pageFiles, book_slug);

    if (failed.length > 0 && uploaded === 0) {
      throw new Error(`Failed to upload any images: ${JSON.stringify(failed)}`);
    }

    // 4. Detect chapters
    const chapters = await detectChapters(pageFiles, totalPages);

    if (chapters.length === 0) {
      throw new Error('No chapters detected');
    }

    // 5. Process each chapter via ingest-vision (sequential orchestration)
    console.log(`\n🔄 Processing ${chapters.length} chapters sequentially...`);
    const chapterResults = [];

    for (const ch of chapters) {
      console.log(`  Processing Chapter ${ch.chapter_number}: "${ch.chapter_title}" (pages ${ch.page_start}-${ch.page_end})...`);

      const result = await processChapter({
        subject_id,
        grade_id,
        part_number: parseInt(part_number, 10),
        book_slug,
        page_from: ch.page_start,
        page_to: ch.page_end,
        chapter_number: ch.chapter_number,
        mode: 'commit',
      });

      chapterResults.push({
        chapter_number: ch.chapter_number,
        chapter_title: ch.chapter_title,
        page_start: ch.page_start,
        page_end: ch.page_end,
        ok: result.ok,
        lessons_written: result.lessons_written,
        chunks_written: result.chunks_written,
        error: result.error,
      });

      if (result.ok) {
        console.log(`    ✅ Processed: ${result.lessons_written} lessons, ${result.chunks_written} chunks`);
      } else {
        console.error(`    ❌ Failed: ${result.error}`);
      }
    }

    // 6. Verify coverage
    const gaps = [];
    for (let p = 1; p <= totalPages; p++) {
      const covered = chapters.some(ch => p >= ch.page_start && p <= ch.page_end);
      if (!covered) gaps.push(p);
    }

    const failedChapters = chapterResults.filter(r => !r.ok);

    console.log(`\n✅ Book processing complete: ${book_slug}`);
    console.log(`   Total pages: ${totalPages}`);
    console.log(`   Pages uploaded: ${uploaded}`);
    console.log(`   Chapters detected: ${chapters.length}`);
    console.log(`   Chapters processed: ${chapterResults.filter(r => r.ok).length}`);
    console.log(`   Failed chapters: ${failedChapters.length}`);
    console.log(`   Coverage gaps: ${gaps.length} pages`);

    return res.json({
      ok: true,
      book_slug,
      total_pages: totalPages,
      pages_uploaded: uploaded,
      chapters_detected: chapters.length,
      chapters: chapterResults,
      gaps,
      failed_chapters: failedChapters.map(ch => ch.chapter_number),
    });

  } catch (err) {
    console.error(`❌ Error processing book: ${err.message}`);
    return res.status(500).json({ error: err.message });
  } finally {
    // Cleanup
    try {
      await fsPromises.rm(tmpDir, { recursive: true, force: true });
      await fsPromises.unlink(pdfPath);
    } catch (cleanupErr) {
      console.error(`⚠️ Cleanup failed: ${cleanupErr.message}`);
    }
  }
});

// ═══ ROUTE: POST /retry ═══
app.post('/retry', async (req, res) => {
  // Disable timeout for long-running operations
  req.setTimeout(0);
  res.setTimeout(0);

  const { subject_id, grade_id, part_number, book_slug, chapters } = req.body;

  if (!subject_id || !part_number || !book_slug || !Array.isArray(chapters)) {
    return res.status(400).json({
      error: 'Missing required fields: subject_id, part_number, book_slug, chapters[]'
    });
  }

  console.log(`\n🔄 Retrying ${chapters.length} chapters for book: ${book_slug}`);

  const results = [];

  for (const ch of chapters) {
    console.log(`  Retrying Chapter ${ch.chapter_number} (pages ${ch.page_from}-${ch.page_to})...`);

    const result = await processChapter({
      subject_id,
      grade_id,
      part_number: parseInt(part_number, 10),
      book_slug,
      page_from: ch.page_from,
      page_to: ch.page_to,
      chapter_number: ch.chapter_number,
      mode: 'commit',
    });

    results.push(result);

    if (result.ok) {
      console.log(`    ✅ Success: ${result.lessons_written} lessons`);
    } else {
      console.error(`    ❌ Failed: ${result.error}`);
    }
  }

  return res.json({
    ok: true,
    book_slug,
    results,
    failed: results.filter(r => !r.ok).length,
  });
});

// ═══ ROUTE: GET /health ═══
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ═══ Start server ═══
app.listen(PORT, () => {
  console.log(`\n🚀 PDF Worker listening on port ${PORT}`);
  console.log(`   SUPABASE_URL: ${SUPABASE_URL}`);
  console.log(`   INGEST_VISION_URL: ${INGEST_VISION_URL}`);
  console.log(`   ALLOWED_ORIGIN: ${ALLOWED_ORIGIN}`);
  console.log(`   Render density: ${RENDER_DENSITY}`);
  console.log(`   Convert chunk size: ${CONVERT_CHUNK}`);
  console.log(`   Detect batch size: ${DETECT_BATCH}`);
  console.log(`\n✅ Ready to process books\n`);
});
