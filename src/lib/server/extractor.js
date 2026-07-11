import { resolveProvider } from "./llm/index.js";
import { extractWithMock } from "./llm/mock.js";
import { normalizeRecord } from "./normalize.js";
import { logger } from "./logger.js";

const DEFAULT_BATCH_SIZE = 25;
const MAX_ATTEMPTS = 3; // initial try + 2 retries per batch

/**
 * Orchestrates AI extraction for a full upload:
 *   1. chunk rows into batches (batch processing)
 *   2. call the provider per batch, retrying transient failures with backoff
 *   3. on repeated failure, fall back to the deterministic mock for that batch
 *      (so one bad batch never fails the whole import)
 *   4. normalize every record and apply the skip rule
 *
 * @param {{ headers: string[], rows: Object[], fileName?: string }} payload
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ imported, skipped, records, skippedRecords, meta }>}
 */
export async function extractLeads(payload, opts = {}) {
  const { headers, rows, fileName = "upload.csv" } = payload;
  const provider = resolveProvider();
  const batchSize = clampBatchSize(process.env.BATCH_SIZE);

  const batches = chunk(rows, batchSize);
  const startedAt = Date.now();
  logger.info("import.start", {
    fileName,
    rows: rows.length,
    batches: batches.length,
    batchSize,
    provider: provider.name,
  });

  const records = [];
  const skippedRecords = [];
  let fallbackBatches = 0;

  for (let b = 0; b < batches.length; b++) {
    const batchRows = batches[b];
    const { raw, usedFallback, attempts } = await runBatch(
      provider,
      headers,
      batchRows,
      b,
      opts.signal
    );
    if (usedFallback) fallbackBatches++;

    // Pair each raw record back to its original row for skip reporting.
    for (let i = 0; i < batchRows.length; i++) {
      const { record, skip } = normalizeRecord(raw[i] || {});
      if (skip) {
        skippedRecords.push({
          reason: "No email or mobile number",
          original: batchRows[i],
        });
      } else {
        records.push(record);
      }
    }

    logger.info("import.batch", {
      fileName,
      batch: b,
      rows: batchRows.length,
      attempts,
      usedFallback,
    });
  }

  const result = {
    imported: records.length,
    skipped: skippedRecords.length,
    records,
    skippedRecords,
    meta: {
      provider: provider.name,
      batches: batches.length,
      fallbackBatches,
      durationMs: Date.now() - startedAt,
    },
  };

  logger.info("import.done", {
    fileName,
    imported: result.imported,
    skipped: result.skipped,
    fallbackBatches,
    durationMs: result.meta.durationMs,
  });

  return result;
}

/**
 * Run one batch through the provider with retry, then fall back to the mock.
 * Returns raw (pre-normalize) records so the caller controls skip accounting.
 */
async function runBatch(provider, headers, batchRows, index, signal) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await provider.extract(headers, batchRows, { signal });
      return { raw, usedFallback: false, attempts: attempt };
    } catch (err) {
      lastErr = err;
      const transient = err?.retryable !== false;
      logger.warn("import.batch.retry", {
        batch: index,
        attempt,
        transient,
        error: String(err?.message || err),
      });
      // Don't waste retries on non-transient errors (e.g. auth) — bail to fallback.
      if (!transient || attempt === MAX_ATTEMPTS) break;
      await backoff(attempt, signal);
    }
  }

  // Provider exhausted — deterministic fallback keeps the import alive.
  logger.warn("import.batch.fallback", {
    batch: index,
    error: String(lastErr?.message || lastErr),
  });
  return {
    raw: extractWithMock(headers, batchRows),
    usedFallback: true,
    attempts: MAX_ATTEMPTS,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clampBatchSize(raw) {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(n, 100);
}

function backoff(attempt, signal) {
  const ms = 300 * 2 ** (attempt - 1); // 300ms, 600ms, ...
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true }
    );
  });
}
