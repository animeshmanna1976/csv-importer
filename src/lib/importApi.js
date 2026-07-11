// Frontend → backend client for the AI extraction step.
//
// The importer calls the standalone Node backend (server/index.mjs). Its base
// URL comes from NEXT_PUBLIC_API_URL (e.g. http://localhost:4000 in dev, or the
// deployed backend host in production). When it's unset, we fall back to a
// same-origin relative call so a single Next.js deployment — which also exposes
// /api/import via app/api/import/route.js — keeps working with zero config.
//
// There is intentionally no browser-side mock: the real extraction (and its
// deterministic rule-based fallback when no GROQ_API_KEY is present) lives in
// the backend, so what the UI shows is always what the backend actually did.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Send the confirmed CSV rows to the backend for AI extraction.
 * Returns the structured result the UI expects:
 *   { imported, skipped, records[], skippedRecords[], meta }
 *
 * @param {{ headers: string[], rows: Object[], fileName: string }} payload
 */
export async function importCsv(payload) {
  const res = await fetch(`${API_BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(await safeErrorMessage(res));
  }

  return res.json();
}

async function safeErrorMessage(res) {
  try {
    const data = await res.json();
    return data.message || data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
