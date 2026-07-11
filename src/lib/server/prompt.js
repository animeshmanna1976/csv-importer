import {
  CRM_FIELDS,
  ALLOWED_CRM_STATUS,
  ALLOWED_DATA_SOURCE,
} from "../constants.js";

/**
 * System prompt for the AI extraction step. It encodes the GrowEasy CRM target
 * schema and the seven mapping rules from the assignment so the model produces
 * clean, CSV-safe records. The business rules are re-enforced deterministically
 * in `normalize.js`; the prompt exists to get the model close, not to be the
 * sole guarantor of correctness.
 */
export function buildSystemPrompt() {
  const fieldLines = CRM_FIELDS.map(
    (f) => `  - ${f.key}: ${f.description}`
  ).join("\n");

  return `You are a data-mapping engine for the GrowEasy CRM. You receive rows from an
arbitrary CSV (any source: Facebook/Google Ads, Excel, other CRMs) and map each
row into the fixed GrowEasy CRM schema.

TARGET FIELDS (use these exact keys; unknown values must be an empty string ""):
${fieldLines}

ENUM CONSTRAINTS:
  - crm_status must be one of: ${ALLOWED_CRM_STATUS.join(", ")} (or "" if none applies).
  - data_source must be one of: ${ALLOWED_DATA_SOURCE.join(", ")} (or "" if none applies).

MAPPING RULES:
  1. Intelligently map source columns to target fields even when names differ
     (e.g. "Phone"/"Contact No" -> mobile_without_country_code, "Full Name" -> name,
     "Lead Status" -> crm_status). Handle messy, ambiguous, or extra columns.
  2. Separate the phone country code (e.g. +91) into country_code and the rest of
     the digits into mobile_without_country_code.
  3. Multiple emails: keep the FIRST in email; append the remaining emails into crm_note.
  4. Multiple mobile numbers: keep the FIRST in mobile_without_country_code; append the
     remaining numbers into crm_note.
  5. Extra useful info that does not fit a specific field goes into description (or
     crm_note if it is a remark/comment about the lead).
  6. CSV-safety: keep each record a single logical row. Do NOT include raw newlines in
     any value; if a value needs a line break, escape it as \\n.
  7. Skip rule: if a row has NEITHER an email NOR any mobile number, mark it with
     "_skip": true. Otherwise omit _skip.

OUTPUT FORMAT:
  Return ONLY a JSON object of the form { "records": [ ... ] }.
  The records array MUST have exactly one entry per input row, in the same order.
  Each entry contains every target field key. No prose, no markdown fences.`;
}

/**
 * User message for one batch: the source headers plus the rows to map, indexed
 * so the model can keep 1:1 ordering.
 */
export function buildUserPrompt(headers, rows) {
  return `Source columns: ${JSON.stringify(headers)}

Rows to map (${rows.length}), preserve order and count:
${JSON.stringify(rows)}`;
}
