import { CRM_FIELD_KEYS } from "../../constants.js";

/**
 * Deterministic, rule-based extractor used as a fallback whenever the LLM is
 * unavailable (no API key), rate-limited, or returns something unusable. It
 * performs heuristic header->field mapping so the importer always works — even
 * with zero configuration — which keeps the project runnable for evaluators who
 * don't want to provision an API key.
 *
 * Business rules (enum coercion, email/phone splitting, skip) are applied later
 * in normalize.js, so this only has to get columns into the right fields.
 *
 * Returns one raw record per row, in order (same contract as extractWithGroq).
 */
export function extractWithMock(headers, rows) {
  return rows.map((row) => mapRow(row));
}

function mapRow(row) {
  const record = {};
  for (const key of CRM_FIELD_KEYS) record[key] = "";

  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = normalize(rawKey);
    const value = (rawValue ?? "").toString().trim();
    if (!value) continue;

    if (matches(key, ["created", "date", "time"]) && !record.created_at)
      record.created_at = value;
    else if (matches(key, ["name", "lead", "contact", "fullname"]) && !record.name)
      record.name = value;
    else if (matches(key, ["email", "mail"]) && !record.email) record.email = value;
    else if (matches(key, ["countrycode", "ccode"]) && !record.country_code)
      record.country_code = value;
    else if (
      matches(key, ["mobile", "phone", "number"]) &&
      !record.mobile_without_country_code
    )
      record.mobile_without_country_code = value;
    else if (matches(key, ["company", "org"]) && !record.company) record.company = value;
    else if (matches(key, ["city"]) && !record.city) record.city = value;
    else if (matches(key, ["state"]) && !record.state) record.state = value;
    else if (matches(key, ["country"]) && !record.country) record.country = value;
    else if (matches(key, ["owner", "agent", "assigned"]) && !record.lead_owner)
      record.lead_owner = value;
    else if (matches(key, ["status"]) && !record.crm_status) record.crm_status = value;
    else if (matches(key, ["note", "remark", "comment"]) && !record.crm_note)
      record.crm_note = value;
    else if (matches(key, ["source"]) && !record.data_source) record.data_source = value;
    else if (matches(key, ["possession"]) && !record.possession_time)
      record.possession_time = value;
    else if (matches(key, ["description", "desc"]) && !record.description)
      record.description = value;
  }

  return record;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const matches = (key, needles) => needles.some((n) => key.includes(n));
