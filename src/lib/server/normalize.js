import {
  CRM_FIELD_KEYS,
  ALLOWED_CRM_STATUS,
  ALLOWED_DATA_SOURCE,
} from "../constants.js";

/**
 * Deterministic post-processing applied to every record regardless of whether it
 * came from the LLM or the rule-based fallback. This is where the assignment's
 * business rules are *authoritatively* enforced, so correctness never depends on
 * the model behaving perfectly:
 *   - enum coercion for crm_status / data_source
 *   - country-code / mobile splitting
 *   - first email/mobile kept, extras appended to crm_note (rules 3-5)
 *   - newline escaping so each record stays a single CSV row (rule 6)
 *   - the skip decision (rule 7) — reported via the returned `skip` flag
 *
 * @returns {{ record: Object, skip: boolean }}
 */
export function normalizeRecord(raw) {
  const record = {};
  for (const key of CRM_FIELD_KEYS) {
    record[key] = escapeNewlines(str(raw[key]));
  }

  const extraNotes = [];

  // ── Emails: first stays, rest overflow into crm_note (rule 3) ──────────
  const emails = splitMulti(record.email);
  if (emails.length > 0) {
    record.email = emails[0];
    if (emails.length > 1) {
      extraNotes.push(`Additional emails: ${emails.slice(1).join(", ")}`);
    }
  }

  // ── Country code / mobile split + multiple mobiles (rules 2 & 4) ───────
  const mobiles = splitMulti(record.mobile_without_country_code);
  if (mobiles.length > 0) {
    const { countryCode, number } = splitCountryCode(mobiles[0]);
    if (!record.country_code && countryCode) record.country_code = countryCode;
    record.mobile_without_country_code = number;
    if (mobiles.length > 1) {
      extraNotes.push(`Additional mobiles: ${mobiles.slice(1).join(", ")}`);
    }
  }

  // Normalize a lone country code value (strip spaces, keep leading +).
  record.country_code = record.country_code.replace(/\s+/g, "");

  // ── Enum coercion ──────────────────────────────────────────────────────
  record.crm_status = coerceEnum(record.crm_status, ALLOWED_CRM_STATUS);
  record.data_source = coerceEnum(record.data_source, ALLOWED_DATA_SOURCE);

  // ── Fold any model-provided note + overflow into crm_note ──────────────
  const modelNote = escapeNewlines(str(raw._note));
  const combinedExtra = [modelNote, ...extraNotes].filter(Boolean).join(" | ");
  if (combinedExtra) {
    record.crm_note = record.crm_note
      ? `${record.crm_note} | ${combinedExtra}`
      : combinedExtra;
  }

  // ── Skip rule (rule 7): neither email nor mobile ───────────────────────
  const skip = !record.email && !record.mobile_without_country_code;

  return { record, skip };
}

// ── helpers ───────────────────────────────────────────────────────────────

const str = (v) => (v ?? "").toString().trim();

const escapeNewlines = (v) => v.replace(/\r\n|\r|\n/g, "\\n");

// Split on common multi-value separators (comma, semicolon, slash, pipe,
// whitespace runs) while keeping "+" for country codes.
function splitMulti(value) {
  return value
    .split(/[,;/|]+|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitCountryCode(mobile) {
  const m = mobile.replace(/[()\-\s]/g, "");
  const explicit = m.startsWith("+");
  const digits = m.replace(/\D/g, "");

  // Heuristic: national mobile numbers are the last 10 digits; anything before
  // them is the country code. Only split when a code is actually present —
  // either an explicit "+" prefix or more than 10 digits (e.g. 919876500011).
  if (digits.length > 10) {
    const number = digits.slice(-10);
    const code = digits.slice(0, -10);
    return { countryCode: `+${code}`, number };
  }
  if (explicit && digits.length > 0) {
    // A "+" with a short number: treat the whole thing as the local number
    // rather than guessing a code we can't reliably split.
    return { countryCode: "", number: digits };
  }
  return { countryCode: "", number: digits };
}

const normKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function coerceEnum(value, allowed) {
  const v = normKey(value);
  if (!v) return "";
  const exact = allowed.find((a) => normKey(a) === v);
  if (exact) return exact;
  const partial = allowed.find(
    (a) => v.includes(normKey(a)) || normKey(a).includes(v)
  );
  return partial || "";
}
