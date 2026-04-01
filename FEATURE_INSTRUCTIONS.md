# QualityLens — Complete Feature Instructions

## For Developers: Everything You Need to Know

**Project**: QualityLens — Jewelry QC Manual Management & AI Checklist System
**Company**: Sky Gold & Diamonds Ltd, Navi Mumbai
**Live URL**: https://qualitylens-production.up.railway.app
**GitHub**: https://github.com/sgroy10/qualitylens
**Admin Login**: admin@skygold.com / admin123

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express (ESM modules) |
| Database | PostgreSQL on Railway |
| AI | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Frontend | React 18 + Vite + Tailwind CSS |
| Data Fetching | React Query (@tanstack/react-query) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| PDF Parsing | pdf-parse (text), pdfimages CLI (images) |
| PDF Generation | Puppeteer (Chromium in Docker) |
| File Uploads | Multer |
| Deployment | Railway (Dockerfile), auto-deploy from GitHub |

## Environment Variables (Railway)

```
DATABASE_URL         → Railway PostgreSQL (auto-set via reference)
GEMINI_API_KEY       → AIzaSyDfPLhg44j-VIEnwc4MTFtHFyghknBSHYk
JWT_SECRET           → qualitylens-skygold-jwt-secret-2026
STORAGE_PATH         → /app/storage
NODE_ENV             → production
CLIENT_URL           → https://qualitylens-production.up.railway.app
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD → true
PUPPETEER_EXECUTABLE_PATH        → /usr/bin/chromium
```

## Project Structure

```
qualitylens/
├── Dockerfile              # Node 20 + Chromium + poppler-utils
├── railway.toml            # Railway build config
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js                    # Express app entry, serves client build
│       ├── db/
│       │   ├── index.js                # pg Pool (DATABASE_URL)
│       │   ├── schema.js               # CREATE TABLE + ALTER TABLE on startup
│       │   └── seed.js                 # Seed: 1 company, 1 admin, 1 customer
│       ├── middleware/
│       │   └── auth.js                 # JWT verify + role check
│       ├── services/
│       │   ├── ai.service.js           # Gemini: generateText, generateTextStream, analyzeImage, parseJSON
│       │   ├── pdf.service.js          # PDF text/image extraction + AI captioning + AI summary
│       │   ├── pdf.print.service.js    # Puppeteer PDF generation (checklist, TPQC, corrective)
│       │   └── checklist.service.js    # AI checklist generation logic
│       └── routes/
│           ├── auth.js                 # POST /login, /register, GET /me
│           ├── customers.js            # CRUD /api/customers
│           ├── manuals.js              # Upload, list, detail, serve PDF, reprocess
│           ├── orders.js               # CRUD + style CRUD + PDF parse + image upload
│           ├── checklists.js           # Generate, CRUD items, status, image upload, PDF
│           ├── chat.js                 # SSE streaming AI chat with manual context
│           ├── ncr.js                  # CRUD /api/ncr
│           ├── tpqc.js                 # CRUD + PDF + corrective measures PDF
│           ├── dashboard.js            # Summary stats
│           └── users.js                # Admin user management
├── client/
│   ├── package.json
│   ├── vite.config.js                  # Proxy /api → localhost:3000
│   ├── tailwind.config.js              # navy=#1F3864, accent=#2E75B6
│   └── src/
│       ├── main.jsx                    # React root with Router, QueryClient, Toaster
│       ├── App.jsx                     # Routes + AuthProvider + ProtectedRoute
│       ├── index.css                   # Tailwind + .btn-primary, .card, .input classes
│       ├── api/client.js               # Axios instance with JWT interceptor
│       ├── hooks/useAuth.jsx           # AuthContext: login, logout, user state
│       ├── components/
│       │   ├── Layout.jsx              # Sidebar + header + Outlet
│       │   ├── Modal.jsx               # Reusable modal
│       │   ├── ConfirmDialog.jsx       # Delete confirmation
│       │   └── LoadingSpinner.jsx      # Centered spinner
│       └── pages/
│           ├── Login.jsx               # Login form
│           ├── Dashboard.jsx           # Stats, recent orders/NCRs, quick actions
│           ├── Customers.jsx           # Customer CRUD with cards
│           ├── Manuals.jsx             # Grouped by customer, auto-refresh, upload
│           ├── ManualDetail.jsx        # PDF viewer tab + extracted content tab + AI summary
│           ├── Orders.jsx              # Order list with filters, create modal
│           ├── OrderDetail.jsx         # Styles table, checklists, TPQC, edit drawer
│           ├── ChecklistView.jsx       # Draft edit mode, finalise, pass/fail/na, PDF
│           ├── Chat.jsx                # AI QC assistant, 22 languages, SSE streaming
│           ├── NCR.jsx                 # NCR register table + create/detail modals
│           ├── TPQC.jsx                # TP QC results + PDF
│           └── Settings.jsx            # User management (admin)
└── storage/                            # Uploaded files (gitignored)
    ├── manuals/uploads/                # Original PDF files
    ├── manuals/{id}/images/            # Extracted images from PDFs
    ├── checklists/{id}/images/         # Uploaded reference images
    ├── orders/                         # Order PDF files
    └── styles/{id}/                    # Style sample images
```

---

## Database Schema (12 tables)

All tables created on startup in `schema.js`. Key tables:

| Table | Purpose |
|-------|---------|
| companies | Manufacturer (Sky Gold) |
| users | Auth users with role (admin/qa_manager/supervisor) and department |
| customers | Corporate clients (CaratLane, Malabar, etc.) |
| manuals | Uploaded QA manual PDFs, status (processing/ready/error), ai_summary JSONB |
| manual_pages | Extracted text per page, embedding_keywords |
| manual_images | Extracted images with AI captions and topic_tags, page_number |
| orders | Customer orders with order_ref, status, file_path |
| order_styles | Line items per order: style code, gold kt, colour, weight, etc. |
| checklists | QC checklist per order per department, status (draft/pending/in_progress/finalised/completed) |
| checklist_items | Individual check points with spec, method, result (pass/fail/na), reference_image_path |
| ncr_register | Non-conformance reports |
| tp_qc_results | Third party QC inspection results per style |

---

## API Routes

### Auth
```
POST /api/auth/login          { email, password } → { token, user }
POST /api/auth/register       Admin only. { name, email, password, role, department }
GET  /api/auth/me             → user object
```

### Customers
```
GET    /api/customers
POST   /api/customers          { name, portal_url, contact_name, contact_email, notes }
PUT    /api/customers/:id
DELETE /api/customers/:id
```

### Manuals
```
GET    /api/manuals             ?customer_id= optional filter
POST   /api/manuals/upload      multipart: file (PDF), customer_id, version
GET    /api/manuals/:id         Returns manual + pages[] + images[]
GET    /api/manuals/:id/file    Streams original PDF (for embedding)
DELETE /api/manuals/:id
POST   /api/manuals/:id/reprocess
```

### Orders
```
GET    /api/orders              ?customer_id= &status= filters
POST   /api/orders              multipart: customer_id, order_ref, remarks, file (optional PDF)
GET    /api/orders/:id          Returns order + styles[] + checklists[]
PUT    /api/orders/:id          { order_ref, remarks, status }
DELETE /api/orders/:id
POST   /api/orders/:id/reparse  Re-run AI parsing of order PDF → populate styles
```

### Order Styles
```
GET    /api/orders/:id/styles
POST   /api/orders/:id/styles                    { vendor_style_code, dye_file_no, gold_kt, ... }
PUT    /api/orders/:id/styles/:styleId
DELETE /api/orders/:id/styles/:styleId
POST   /api/orders/:id/styles/:styleId/image     multipart: image file
```

### Checklists
```
GET    /api/checklists          ?order_id= filter
POST   /api/checklists/generate { order_id, department } → AI generates 10-15 check items
GET    /api/checklists/:id      Returns checklist + items[]
PUT    /api/checklists/:id/status               { status: draft|pending|in_progress|finalised }
POST   /api/checklists/:id/items                { check_point, specification, verification_method, manual_page_ref }
PUT    /api/checklists/:id/items/:itemId         { check_point, specification, verification_method, result, remarks }
DELETE /api/checklists/:id/items/:itemId
POST   /api/checklists/:id/items/:itemId/image   multipart: image file
GET    /api/checklists/:id/pdf                   Puppeteer PDF download
```

### Chat (SSE Streaming)
```
POST /api/chat    { message, customer_id, history[] }
                  Response: text/event-stream
                  data: {"meta":{"language":"Hindi"}}  (if non-English detected)
                  data: {"text":"...chunk..."}
                  data: [DONE]
```

### NCR
```
GET    /api/ncr                 ?customer_id= &status= filters
POST   /api/ncr                 { customer_id, order_id, ncr_ref, rejection_category, ... }
GET    /api/ncr/:id
PUT    /api/ncr/:id             { rejection_category, defect_description, root_cause, corrective_action, status }
```

### Third Party QC
```
GET    /api/tp-qc                               ?order_id= filter
POST   /api/tp-qc                               { order_id, style_id, qty_sent, result, ... }
PUT    /api/tp-qc/:id
GET    /api/tp-qc/:id/pdf                       Puppeteer result sheet PDF
GET    /api/tp-qc/corrective-measures/:orderId/pdf   Corrective measures letter PDF
```

### Dashboard
```
GET /api/dashboard/summary    → { open_orders, pending_checklists, open_ncrs, ready_manuals,
                                  rejection_rate_this_month, recent_orders[], recent_ncrs[] }
```

---

## Known Bugs & Issues to Fix

### BUG 1: PDF Viewer Shows "No token provided" (CRITICAL)
**File**: `client/src/pages/ManualDetail.jsx`
**Problem**: The "Read Manual" tab uses `<iframe src="/api/manuals/:id/file">` but the API requires JWT auth via `Authorization: Bearer <token>` header. iframes cannot send custom headers.
**Fix Options**:
1. **Best**: Make `GET /api/manuals/:id/file` accept a `?token=` query parameter as an alternative to the header. In `server/src/routes/manuals.js`, update the route to check `req.query.token` if no Authorization header. In the frontend, pass `src={/api/manuals/${id}/file?token=${localStorage.getItem('token')}}`.
2. **Alternative**: Create a temporary signed URL system.
3. **Alternative**: Use a PDF.js viewer library instead of iframe.

### BUG 2: Manual Text Extraction — All Text as 1 Page
**File**: `server/src/services/pdf.service.js`
**Problem**: `pdf-parse` extracts all text as a single block. The code splits by form-feed (`\f`) but many PDFs don't have form-feeds, so all 87 pages end up as 1 entry in `manual_pages`.
**Fix**: Use a library like `pdf2json` or `pdfjs-dist` that gives text per page. Or use Gemini to split the text into logical sections.

### BUG 3: Manual Processing Takes 25-30 min for Large PDFs
**File**: `server/src/services/pdf.service.js`
**Problem**: For an 87-page PDF with 543 images, each image gets an individual Gemini API call for captioning (~3 sec each = ~27 min).
**Fix Options**:
1. Skip images smaller than 10KB (many are decorative backgrounds)
2. Batch process — send 4-5 images per API call (Gemini supports multiple images)
3. Cap at 100 images max per manual, skip the rest
4. Process images in parallel (5 concurrent) instead of sequentially
5. Make captioning optional — do a quick pass first, queue captioning as background job

### BUG 4: AI Summary Card Layout
**File**: `client/src/pages/ManualDetail.jsx`
**Problem**: The AI summary card displays raw arrays as comma-separated text. For manuals with lots of tolerances, the card becomes very long and ugly.
**Fix**: Limit displayed items to 5-6 per category with "Show more" toggle. Use collapsible sections.

### BUG 5: Checklist PDF — Reference Images May Not Render
**File**: `server/src/services/pdf.print.service.js`
**Problem**: `imageToBase64()` tries to read files from `/storage/...` path. On Railway, the storage path is `/app/storage`. The path resolution may fail if the stored path doesn't match.
**Fix**: Ensure `imageToBase64` handles both `/storage/manuals/...` and absolute paths correctly. Test with actual uploaded images.

---

## Feature Descriptions (User Journeys)

### Journey 1: Upload QA Manual
1. Admin → QA Manuals → Select customer → Upload PDF
2. Backend: stores PDF, extracts text (pdf-parse), extracts images (pdfimages CLI), captions each image with Gemini Vision, generates AI summary of the manual
3. Status: processing → ready
4. Frontend auto-refreshes every 5 seconds while processing
5. When ready: shows AI Summary Card with approved alloys, key tolerances, product categories, finding requirements

### Journey 2: Read Manual
1. Click manual card → ManualDetail page
2. Tab 1 "Read Manual": shows actual PDF in iframe (CURRENTLY BROKEN — see Bug 1)
3. Tab 2 "Extracted Content": shows text per page + extracted images with AI captions

### Journey 3: Create Order
1. Orders → New Order → select customer, enter order ref, optionally upload order PDF
2. If PDF uploaded: AI extracts style line items (vendor_style_code, gold_kt, colour, weight, etc.)
3. Order Detail page: styles table, edit drawer for each style, "Parse from PDF" re-run button
4. Style edit drawer: all fields editable, portal URL with "Open" link, sample image upload

### Journey 4: Generate QC Checklist
1. Order Detail → Checklists tab → 6 department cards (CAD, Casting, Filing, Polish, Plating, Final)
2. Click "Generate" → AI reads customer manual + order styles → generates 10-15 check points
3. Checklist opens in Draft mode: add/edit/delete items, upload reference images
4. "Finalise" locks the checklist → Supervisor fills Pass/Fail/NA + remarks
5. "Print PDF" → Puppeteer-generated A4 PDF with department color coding, stats, sign-off section, embedded reference images

### Journey 5: Third Party QC
1. Order Detail → TP QC tab → "Add QC Result" inline form
2. Select style, enter qty, standard checked, TP person name, date
3. Pass/Fail/Rework toggle buttons
4. Results table → per-row "Print" PDF link
5. "Corrective Measures PDF" → formal letter format for all failed/rework items

### Journey 6: AI Chat Assistant
1. AI Chat page → select customer context
2. Loads ENTIRE manual content into Gemini prompt (not just keyword matches)
3. Triple personality: strict QC auditor + expert mentor + manual master
4. 22 Indian language support (script detection + romanized/Hinglish)
5. SSE streaming, conversation history, quick questions

### Journey 7: NCR Register
1. NCR page → table of all non-conformance reports
2. Create NCR: select customer, order, enter ref, category, defect, root cause, corrective action
3. Close NCR when resolved

### Journey 8: Dashboard
1. Stats: open orders, pending checklists, open NCRs, ready manuals
2. Rejection rate banner (based on last 30 days TP QC)
3. Recent orders + NCRs tables
4. Quick action buttons

---

## AI Features (All use Gemini 2.5 Flash)

| Feature | Prompt Location | Input | Output |
|---------|----------------|-------|--------|
| Image Captioning | pdf.service.js | Image buffer + prompt | Caption + topic tags |
| Manual Summary | pdf.service.js | Full manual text | JSON: alloys, tolerances, categories, summary |
| Order Style Parsing | orders.js | Order PDF text | JSON array of style objects |
| Checklist Generation | checklist.service.js | Manual content + order styles + department | JSON array of 10-15 check items |
| QC Chat | chat.js | User message + full manual + conversation history | Streaming text response |

---

## Deployment

### Deploy to Railway
```bash
cd qualitylens
git add -A && git commit -m "message" && git push
railway up --detach
```

### Local Development
```bash
# Terminal 1: Backend
cd server && npm install && npm run dev

# Terminal 2: Frontend
cd client && npm install && npm run dev
```

### Seed Database
```bash
cd server
DATABASE_URL="postgresql://..." node src/db/seed.js
```

### Key Railway CLI Commands
```bash
railway status
railway variables
railway variables --set "KEY=VALUE"
railway logs
railway up --detach
```

---

## Color Scheme
- Navy: `#1F3864` (primary, sidebar, headers)
- Accent: `#2E75B6` (links, highlights)
- Backgrounds: white, `#f8fafc`
- CSS classes: `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.card`, `.input`, `.label`

---

## Database Connection
- Internal (Railway services): `postgresql://postgres:GcmjoFBWaaNVdDoxMIHOVoFjJBAeirBK@postgres.railway.internal:5432/railway`
- Public (local dev): `postgresql://postgres:GcmjoFBWaaNVdDoxMIHOVoFjJBAeirBK@interchange.proxy.rlwy.net:55127/railway`

---

*Last updated: 2026-04-01*
*Built by Sandeep Roy / Sky Gold & Diamonds Ltd*
