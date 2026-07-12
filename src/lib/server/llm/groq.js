import { buildSystemPrompt, buildUserPrompt } from "../prompt.js";
import { CrmBatchSchema } from "../schema.js";

/**
 * Groq chat-completions call. Groq exposes an OpenAI-compatible endpoint, so we
 * hit it with plain fetch (no SDK) to avoid version drift. JSON mode is enabled
 * via response_format so the model returns parseable JSON.
 *
 * Throws on any failure (missing key, HTTP error, malformed/invalid JSON) so the
 * extractor's retry + fallback logic can take over.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function isGroqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function extractWithGroq(headers, rows, { signal } = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const model = process.env.LLM_MODEL || DEFAULT_MODEL;

  const res = await fetch(GROQ_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(headers, rows) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Groq request failed (${res.status}): ${body.slice(0, 300)}`);
    err.status = res.status;

    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }

  const payload = await res.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");

  const parsed = CrmBatchSchema.parse(JSON.parse(content));

  // Guard the 1:1 contract: the model must return one record per input row.
  if (parsed.records.length !== rows.length) {
    throw new Error(
      `Groq returned ${parsed.records.length} records for ${rows.length} rows`
    );
  }

  return parsed.records;
}
