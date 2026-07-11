import http from "node:http";
import nextEnv from "@next/env";
import { extractLeads } from "../src/lib/server/extractor.js";
import { logger } from "../src/lib/server/logger.js";

// @next/env ships as CommonJS, so under native ESM we take the default export
// and destructure the loader from it (named ESM imports aren't supported).
const { loadEnvConfig } = nextEnv;

/**
 * Standalone backend for the GrowEasy CSV Importer.
 *
 * The AI extraction lives entirely in src/lib/server (extractor + normalize +
 * llm/*), so this file is just a thin transport layer: it loads env the same
 * way Next does (quote-stripping via @next/env), then serves the import API on
 * its OWN port so the frontend (Next, :3000) and backend (:4000) are cleanly
 * separated. Dependency-free — plain node:http, no Express needed.
 */

// Load .env / .env.local exactly like Next (strips surrounding quotes on keys).
loadEnvConfig(process.cwd());

const PORT = Number.parseInt(process.env.BACKEND_PORT || "4000", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const MAX_ROWS = 50_000; // mirrors the frontend's file cap
const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25MB guard against runaway payloads

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** Lightweight shape check — the same contract the Next route enforced with Zod. */
function validate(body) {
  if (!body || typeof body !== "object") return "Request body must be a JSON object.";
  if (!Array.isArray(body.headers) || body.headers.length === 0)
    return "headers must be a non-empty array";
  if (!body.headers.every((h) => typeof h === "string"))
    return "headers must be an array of strings";
  if (!Array.isArray(body.rows)) return "rows must be an array";
  if (body.rows.length > MAX_ROWS) return `Too many rows (max ${MAX_ROWS})`;
  return null;
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { status: "ok", service: "groweasy-backend", port: PORT });
    return;
  }

  if (req.url !== "/api/import") {
    sendJson(res, 404, { error: "not_found", message: "Unknown route." });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      error: "method_not_allowed",
      message: "Use POST to import CSV rows.",
    });
    return;
  }

  // ── POST /api/import ──────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    const tooLarge = String(err?.message) === "payload_too_large";
    sendJson(res, tooLarge ? 413 : 400, {
      error: tooLarge ? "payload_too_large" : "invalid_json",
      message: tooLarge
        ? "Request body is too large."
        : "Request body must be valid JSON.",
    });
    return;
  }

  const invalid = validate(body);
  if (invalid) {
    sendJson(res, 400, { error: "invalid_request", message: invalid });
    return;
  }

  const { headers, rows, fileName } = body;

  if (rows.length === 0) {
    sendJson(res, 200, {
      imported: 0,
      skipped: 0,
      records: [],
      skippedRecords: [],
      meta: { provider: "none", batches: 0, fallbackBatches: 0, durationMs: 0 },
    });
    return;
  }

  try {
    const result = await extractLeads({ headers, rows, fileName });
    sendJson(res, 200, result);
  } catch (err) {
    logger.error("import.failed", { fileName, error: String(err?.message || err) });
    sendJson(res, 500, {
      error: "extraction_failed",
      message: "Failed to process the CSV. Please try again.",
    });
  }
});

server.listen(PORT, () => {
  logger.info("backend.listening", { port: PORT, corsOrigin: CORS_ORIGIN });
  console.log(`GrowEasy backend listening on http://localhost:${PORT}`);
});
