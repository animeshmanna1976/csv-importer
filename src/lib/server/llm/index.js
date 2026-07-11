import { extractWithGroq, isGroqConfigured } from "./groq.js";
import { extractWithMock } from "./mock.js";

/**
 * Provider selector. LLM_PROVIDER pins a provider explicitly; otherwise we use
 * Groq when a key is present and fall back to the deterministic mock when it
 * isn't. New providers (OpenAI, Gemini, ...) can be added here without touching
 * the extractor or the route.
 */
export function resolveProvider() {
  const explicit = (process.env.LLM_PROVIDER || "").toLowerCase();

  if (explicit === "mock") {
    return { name: "mock", extract: async (h, r) => extractWithMock(h, r) };
  }
  if (explicit === "groq" || (!explicit && isGroqConfigured())) {
    return { name: "groq", extract: extractWithGroq };
  }
  // Default: no key, no explicit provider -> deterministic fallback.
  return { name: "mock", extract: async (h, r) => extractWithMock(h, r) };
}
