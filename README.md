# GrowEasy CSV Importer

AI-powered CSV lead importer for the GrowEasy CRM. Upload any CSV (Facebook/Google
Ads exports, Excel, other CRMs), preview it, and the backend maps arbitrary columns
into the fixed GrowEasy CRM schema using an LLM — with a deterministic fallback so it
always works.

Built as a **Next.js** frontend + a **standalone Node.js** backend, using **Groq**
for AI extraction and **Zod** for output validation.

## Features

- 4-step flow: **Upload → Preview → Confirm → Result**
- Drag & drop upload, dark mode, loading states, error handling
- In-browser CSV parsing (PapaParse) — preview before importing, no AI until you confirm
- AI field mapping into the 15-field GrowEasy CRM schema
- **Batch processing** with **per-batch retry + backoff**
- **Deterministic rule-based fallback** when no API key is set or the LLM fails/rate-limits — the importer never hard-fails
- Enum coercion (`crm_status`, `data_source`), country-code/mobile splitting,
  multi-email/multi-mobile overflow into `crm_note`, CSV-safe newline escaping,
  and the "skip if no email and no mobile" rule
- Structured request/batch logging (stdout + optional file)
- Unit tests for the business rules, Docker setup for the backend

## Architecture

Two processes: a Next.js frontend (**:3000**) and a standalone Node.js backend
(**:4000**). The frontend parses and previews the CSV in the browser, then POSTs
the confirmed rows to the backend, which does the AI extraction.

```
Browser (Next, :3000)                    Backend (Node, :4000 — server/index.mjs)
  parse + preview (PapaParse)                 │
  ── POST /api/import ──────────────────────► validate (headers/rows/size)
     { headers, rows, fileName }              ▼
                                          extractor.js
                                    chunk rows into batches (BATCH_SIZE)
                                                │
                                for each batch: ├─ provider.extract()  (Groq, JSON mode)
                                                │     retry x3 w/ backoff on transient errors
                                                │     └─ on failure → deterministic fallback
                                                ▼
                                         normalize.js  (enum coercion, phone split,
                                                        overflow → crm_note, skip rule)
                                                ▼
                      { imported, skipped, records[], skippedRecords[], meta }
```

The LLM gets records *close*; `normalize.js` deterministically **enforces** the
business rules, so correctness never depends on the model behaving perfectly.

> The same extraction core is also exposed as a Next.js API route
> (`src/app/api/import/route.js`), so the app can alternatively run as a **single
> Next.js deployment** — leave `NEXT_PUBLIC_API_URL` empty and the frontend calls
> the same-origin `/api/import`.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure (optional — runs without a key via the fallback extractor)
cp .env.example .env
#   then add your free Groq key: GROQ_API_KEY=gsk_...

# 3. Run both the frontend and backend together
npm run dev:all
# frontend → http://localhost:3000   backend → http://localhost:4000
```

Or run them in separate terminals: `npm run backend` and `npm run dev`.

A sample file is provided at `public/sample-leads.csv`.

## Scripts

| Script            | What it does                                       |
| ----------------- | -------------------------------------------------- |
| `npm run dev:all` | Backend (:4000) + Next.js dev server (:3000)       |
| `npm run backend` | Standalone Node backend only (`server/index.mjs`)  |
| `npm run dev`     | Next.js frontend only                              |
| `npm run build`   | Production build of the frontend                   |
| `npm test`        | Unit tests for the business rules (`node --test`)  |

## Configuration

| Variable              | Default                   | Purpose                                          |
| --------------------- | ------------------------- | ------------------------------------------------ |
| `GROQ_API_KEY`        | —                         | Groq key. Absent → automatic rule-based fallback |
| `LLM_PROVIDER`        | auto                      | `groq` or `mock` to force a provider             |
| `LLM_MODEL`           | `llama-3.3-70b-versatile` | Model id                                         |
| `BATCH_SIZE`          | `25`                      | Rows per AI batch (1–100)                        |
| `LOG_TO_FILE`         | `false`                   | Also write `logs/import-YYYY-MM-DD.log`          |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000`   | Backend base URL the frontend calls (empty → same-origin) |
| `BACKEND_PORT`        | `4000`                    | Port for the standalone backend                  |
| `CORS_ORIGIN`         | `*`                       | Browser origin allowed to call the backend       |

## API

`POST /api/import` — served by both the standalone backend and the Next.js route.

```jsonc
// request
{ "headers": ["Name","Email",...], "rows": [ { "Name": "...", ... } ], "fileName": "leads.csv" }

// response
{
  "imported": 42,
  "skipped": 3,
  "records": [ { "created_at": "...", "name": "...", "email": "...", ... } ],
  "skippedRecords": [ { "reason": "No email or mobile number", "original": { ... } } ],
  "meta": { "provider": "groq", "batches": 2, "fallbackBatches": 0, "durationMs": 812 }
}
```

The backend also exposes `GET /health` for liveness checks.

## Logs

Every request logs structured JSON lines to **stdout** (`import.start`,
`import.batch`, `import.batch.retry`, `import.batch.fallback`, `import.done`).
Set `LOG_TO_FILE=true` to also append them to `./logs/import-<date>.log`.

## Deployment

- **Frontend** → Vercel (or any Next.js host). Set `NEXT_PUBLIC_API_URL` to the
  deployed backend URL.
- **Backend** → Railway / Render / Fly / any container host. A `Dockerfile` is
  included:

  ```bash
  docker build -t groweasy-backend .
  docker run -p 4000:4000 --env-file .env groweasy-backend
  ```

  Set `CORS_ORIGIN` to your deployed frontend origin.

Alternatively, deploy just the Next.js app (frontend + `/api/import` route) as a
single Vercel project and leave `NEXT_PUBLIC_API_URL` empty.

## Project structure

```
server/
  index.mjs                   # standalone Node backend (node:http, dependency-free)
src/
  app/
    api/import/route.js       # same extractor exposed as a Next.js API route
    page.jsx                  # 4-step UI
  components/                 # Dropzone, DataTable, Stepper, StatusBadge, ...
  lib/
    parseCsv.js               # browser CSV parsing
    importApi.js              # frontend → backend client
    constants.js              # CRM schema + allowed enums
    server/
      extractor.js            # batching + retry + fallback orchestration
      normalize.js            # deterministic business-rule enforcement
      normalize.test.js       # unit tests for the business rules
      prompt.js               # system/user prompts (the 7 mapping rules)
      schema.js               # Zod schemas for LLM output
      logger.js               # structured logging
      llm/
        index.js              # provider selector
        groq.js               # Groq call (OpenAI-compatible, JSON mode)
        mock.js               # deterministic fallback extractor
Dockerfile                    # containerizes the standalone backend
```
