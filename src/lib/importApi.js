import { CRM_FIELD_KEYS, ALLOWED_CRM_STATUS, ALLOWED_DATA_SOURCE } from "./constants";

// Backend base URL. When the Node/Express + AI backend is ready, set
// NEXT_PUBLIC_API_URL and the frontend will call it. Until then, the mock
// below lets the whole 4-step flow run end to end.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Send the confirmed CSV rows to the backend for AI extraction.
 * Returns the structured result the UI expects:
 *   { imported: number, skipped: number, records: Object[], skippedRecords: Object[] }
 *
 * @param {{ headers: string[], rows: Object[], fileName: string }} payload
 */
export async function importCsv(payload) {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const message = await safeErrorMessage(res);
      throw new Error(message);
    }

    return res.json();
  }

  // ── Mock path (no backend configured) ──────────────────────────────
  return mockExtract(payload.rows);
}

async function safeErrorMessage(res) {
  try {
    const data = await res.json();
    return data.message || data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

// A heuristic stand-in for the AI extraction step. It performs naive field
// mapping so the results screen shows realistic data. The real intelligence
// lives in the backend; this only exists so the frontend is usable standalone.
async function mockExtract(rows) {
  await delay(1200); // simulate network + AI latency for loading states

  const records = [];
  const skippedRecords = [];

  for (const row of rows) {
    const record = mapRow(row);

    // Per AI instructions: skip records with neither email nor mobile.
    if (!record.email && !record.mobile_without_country_code) {
      skippedRecords.push({
        reason: "No email or mobile number",
        original: row,
      });
      continue;
    }
    records.push(record);
  }

  return {
    imported: records.length,
    skipped: skippedRecords.length,
    records,
    skippedRecords,
  };
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
    else if (matches(key, ["mobile", "phone", "number"]) && !record.mobile_without_country_code)
      record.mobile_without_country_code = value;
    else if (matches(key, ["company", "org"]) && !record.company) record.company = value;
    else if (matches(key, ["city"]) && !record.city) record.city = value;
    else if (matches(key, ["state"]) && !record.state) record.state = value;
    else if (matches(key, ["country"]) && !record.country) record.country = value;
    else if (matches(key, ["owner", "agent", "assigned"]) && !record.lead_owner)
      record.lead_owner = value;
    else if (matches(key, ["status"]) && !record.crm_status)
      record.crm_status = coerceEnum(value, ALLOWED_CRM_STATUS);
    else if (matches(key, ["note", "remark", "comment"]) && !record.crm_note)
      record.crm_note = value;
    else if (matches(key, ["source"]) && !record.data_source)
      record.data_source = coerceEnum(value, ALLOWED_DATA_SOURCE);
    else if (matches(key, ["possession"]) && !record.possession_time)
      record.possession_time = value;
    else if (matches(key, ["description", "desc"]) && !record.description)
      record.description = value;
  }

  return record;
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const matches = (key, needles) => needles.some((n) => key.includes(n));

function coerceEnum(value, allowed) {
  const v = normalize(value);
  const hit = allowed.find((a) => normalize(a) === v || v.includes(normalize(a)));
  return hit || value;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
