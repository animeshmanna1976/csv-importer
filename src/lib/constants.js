// GrowEasy CRM target schema. The AI backend maps arbitrary CSV columns into
// these fields. The frontend uses this list to render the parsed-result table
// in a consistent order regardless of the uploaded file's structure.

export const CRM_FIELDS = [
  { key: "created_at", label: "Created At", description: "Lead creation date" },
  { key: "name", label: "Name", description: "Lead name" },
  { key: "email", label: "Email", description: "Primary email" },
  { key: "country_code", label: "Country Code", description: "Country code" },
  {
    key: "mobile_without_country_code",
    label: "Mobile",
    description: "Mobile number",
  },
  { key: "company", label: "Company", description: "Company name" },
  { key: "city", label: "City", description: "City" },
  { key: "state", label: "State", description: "State" },
  { key: "country", label: "Country", description: "Country" },
  { key: "lead_owner", label: "Lead Owner", description: "Lead owner" },
  { key: "crm_status", label: "CRM Status", description: "Lead status" },
  { key: "crm_note", label: "CRM Note", description: "Notes/remarks" },
  { key: "data_source", label: "Data Source", description: "Source" },
  {
    key: "possession_time",
    label: "Possession Time",
    description: "Property possession time",
  },
  { key: "description", label: "Description", description: "Additional description" },
];

export const CRM_FIELD_KEYS = CRM_FIELDS.map((f) => f.key);

// Allowed enum values, per the assignment's AI instructions. Kept here so the
// UI can render them (e.g. status chips) consistently with the backend.
export const ALLOWED_CRM_STATUS = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
];

export const ALLOWED_DATA_SOURCE = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
];

// Max upload size mirrors the reference screenshot ("max 5MB").
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
