# Mizan PDF Worker

Hardened PDF processing service for Mizan book ingestion pipeline. Designed to run on Render.com with full engineering safeguards against OOM, timeout, and API limits.

## Architecture

**PDF → Images (chunked) → Chapter Detection (compressed batches) → ingest-vision per chapter**

### Engineering Safeguards

1. **CORS**: Full preflight + configurable origin (`ALLOWED_ORIGIN`)
2. **OOM Prevention**: Chunked PDF conversion (`CONVERT_CHUNK=5` pages at a time)
3. **Gemini Limits**: Compressed detection images (50 DPI, JPEG 40%) + batched requests (`DETECT_BATCH=15`)
4. **Timeout Handling**: `req.setTimeout(0)` and `res.setTimeout(0)` for long operations (5-10 min)
5. **Retry Logic**: 3 attempts with exponential backoff (2s, 4s, 6s)
6. **Idempotency**: Upsert for image uploads, sequential chapter processing

---

## Deployment on Render

### 1. Create Docker Service

- **Name**: `mizan-pdf-worker`
- **Region**: Choose closest to Supabase
- **Build**: Dockerfile
- **Dockerfile Path**: `services/pdf-worker/Dockerfile`
- **Plan**: At least **Starter** (512MB RAM minimum for PDF processing)

### 2. Environment Variables

Set these in Render dashboard:

```bash
SUPABASE_URL=https://lzfgjvafmvofwjiyvelq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
INGEST_VISION_URL=https://lzfgjvafmvofwjiyvelq.supabase.co/functions/v1/ingest-vision
ALLOWED_ORIGIN=*
PORT=10000
```

**Security Note**: For production, set `ALLOWED_ORIGIN` to your admin panel domain.

### 3. Health Check

- **Path**: `/health`
- **Expected Response**: `{"ok":true}`

---

## API Endpoints

### POST /process-book

Process a complete PDF book: convert to images, upload to storage, detect chapters, and ingest via `ingest-vision`.

**Request** (multipart/form-data):
```bash
curl -X POST \
  https://your-worker.onrender.com/process-book \
  -F "file=@/path/to/book.pdf" \
  -F "subject_id=uuid" \
  -F "grade_id=uuid" \
  -F "part_number=1" \
  -F "book_slug=math-grade1-part1"
```

**Response**:
```json
{
  "ok": true,
  "book_slug": "math-grade1-part1",
  "total_pages": 137,
  "pages_uploaded": 137,
  "chapters_detected": 7,
  "chapters": [
    {
      "chapter_number": 1,
      "chapter_title": "القيمة المنزلية",
      "page_start": 10,
      "page_end": 35,
      "ok": true,
      "lessons_written": 5,
      "chunks_written": 23,
      "error": null
    }
  ],
  "gaps": [],
  "failed_chapters": []
}
```

**Duration**: 5-10 minutes for ~140 page book (depends on Render plan and Gemini API speed).

---

### POST /retry

Retry failed chapters from a previous run.

**Request** (JSON):
```bash
curl -X POST \
  https://your-worker.onrender.com/retry \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "uuid",
    "grade_id": "uuid",
    "part_number": 1,
    "book_slug": "math-grade1-part1",
    "chapters": [
      {
        "chapter_number": 3,
        "page_from": 50,
        "page_to": 70
      }
    ]
  }'
```

**Response**:
```json
{
  "ok": true,
  "book_slug": "math-grade1-part1",
  "results": [
    {
      "ok": true,
      "chapter_number": 3,
      "lessons_written": 4,
      "chunks_written": 18
    }
  ],
  "failed": 0
}
```

---

### GET /health

Health check endpoint.

**Response**: `{"ok":true}`

---

## Configuration Tuning

Adjust these constants in `index.js` based on your Render plan:

### Memory Constraints

| Plan | RAM | `CONVERT_CHUNK` | `DETECT_BATCH` |
|------|-----|-----------------|----------------|
| Starter | 512MB | 3 | 10 |
| Standard | 2GB | 5 (default) | 15 (default) |
| Pro | 4GB+ | 10 | 20 |

**CONVERT_CHUNK**: Pages converted simultaneously (higher = faster but more RAM)
**DETECT_BATCH**: Pages sent to Gemini per request (higher = fewer API calls but larger payload)

### Image Quality

```javascript
const RENDER_DENSITY = 150;      // DPI for final images (72-300)
const DETECT_DENSITY = 50;       // DPI for chapter detection (30-100)
const DETECT_JPEG_QUALITY = 40;  // JPEG quality for detection (20-80)
```

**Trade-off**: Lower density/quality = faster processing + less RAM, but may miss chapter headers.

---

## Timeout Handling

**Critical**: The service uses `req.setTimeout(0)` and `res.setTimeout(0)` to disable Express's default 2-minute timeout. This is **required** for processing large books (5-10 min operations).

If you encounter premature disconnections on Render:
1. Check Render's load balancer timeout (default 30s for free tier)
2. Upgrade to paid plan for longer request timeouts
3. Consider breaking into smaller chunks via `/retry` endpoint

---

## Logs

Monitor Render logs for real-time progress:

```
🚀 Processing book: math-grade1-part1
📊 Total pages: 137
📄 Converting PDF: 137 pages (chunk size: 5)
  Converting batch 1-5...
  Converting batch 6-10...
  ...
✅ Converted 137/137 pages
📤 Uploading 137 images to lesson_pages/math-grade1-part1...
✅ Uploaded 137/137 images
🔍 Detecting chapters from 137 pages (batch size: 15)...
  Analyzing batch pages 1-15...
  Analyzing batch pages 16-30...
  ...
✅ Detected 7 chapters
🔄 Processing 7 chapters sequentially...
  Processing Chapter 1: "القيمة المنزلية" (pages 10-35)...
    ✅ Processed: 5 lessons, 23 chunks
  ...
✅ Book processing complete: math-grade1-part1
```

---

## Troubleshooting

### "Failed to convert any pages"
- Check Ghostscript installation in Docker image
- Verify PDF is not corrupted
- Increase `CONVERT_CHUNK` timeout (requires code edit)

### "No chapters detected"
- Verify chapter headers are visible in detection images
- Increase `DETECT_DENSITY` and `DETECT_JPEG_QUALITY`
- Check Gemini API quota/limits

### "Request timeout"
- Ensure `req.setTimeout(0)` is present in route handlers
- Upgrade Render plan for longer request timeouts
- Split processing via `/retry` endpoint

### "Out of memory"
- Reduce `CONVERT_CHUNK` and `DETECT_BATCH`
- Upgrade Render plan
- Process smaller page ranges via `/retry`

---

## Local Development

```bash
cd services/pdf-worker
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

**Note**: Requires system dependencies:
- Ghostscript
- GraphicsMagick
- Poppler Utils

On macOS:
```bash
brew install ghostscript graphicsmagick poppler
```

On Ubuntu/Debian:
```bash
apt-get install ghostscript graphicsmagick poppler-utils
```

---

## License

Part of the Mizan educational platform.
