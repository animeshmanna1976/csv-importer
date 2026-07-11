import { NextResponse } from "next/server";
import { z } from "zod";
import { extractLeads } from "@/lib/server/extractor";
import { logger } from "@/lib/server/logger";

// fs-based logging + no caching: force the Node runtime and dynamic execution.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guardrail so a huge payload can't exhaust memory. Mirrors the frontend's 5MB
// file cap (~ tens of thousands of rows).
const MAX_ROWS = 50_000;

const ImportRequestSchema = z.object({
  headers: z.array(z.string()).min(1, "headers must be a non-empty array"),
  rows: z
    .array(z.record(z.string(), z.any()))
    .max(MAX_ROWS, `Too many rows (max ${MAX_ROWS})`),
  fileName: z.string().optional(),
});

/**
 * POST /api/import
 * Body:  { headers: string[], rows: Object[], fileName?: string }
 * Reply: { imported, skipped, records[], skippedRecords[], meta }
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = ImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: parsed.error.issues[0]?.message || "Invalid request payload.",
      },
      { status: 400 }
    );
  }

  const { headers, rows, fileName } = parsed.data;

  // Empty upload is a valid (if trivial) request — return an empty result.
  if (rows.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: 0,
      records: [],
      skippedRecords: [],
      meta: { provider: "none", batches: 0, fallbackBatches: 0, durationMs: 0 },
    });
  }

  try {
    const result = await extractLeads(
      { headers, rows, fileName },
      { signal: request.signal }
    );
    return NextResponse.json(result);
  } catch (err) {
    logger.error("import.failed", {
      fileName,
      error: String(err?.message || err),
    });
    return NextResponse.json(
      {
        error: "extraction_failed",
        message: "Failed to process the CSV. Please try again.",
      },
      { status: 500 }
    );
  }
}

// Friendly 405 for accidental GETs (e.g. hitting the URL in a browser).
export function GET() {
  return NextResponse.json(
    { error: "method_not_allowed", message: "Use POST to import CSV rows." },
    { status: 405 }
  );
}
