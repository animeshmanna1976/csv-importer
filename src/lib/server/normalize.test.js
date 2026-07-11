import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeRecord } from "./normalize.js";

// The normalizer is where the assignment's business rules are authoritatively
// enforced (regardless of whether a record came from the LLM or the fallback),
// so it's the highest-value unit to test. Run with: npm test

test("keeps a clean record and does not skip it", () => {
  const { record, skip } = normalizeRecord({
    name: "John Doe",
    email: "john@example.com",
    mobile_without_country_code: "9876543210",
  });
  assert.equal(skip, false);
  assert.equal(record.name, "John Doe");
  assert.equal(record.email, "john@example.com");
  assert.equal(record.mobile_without_country_code, "9876543210");
});

test("rule 7: skips a record with neither email nor mobile", () => {
  const { skip } = normalizeRecord({ name: "No Contact", company: "Acme" });
  assert.equal(skip, true);
});

test("rule 7: does NOT skip when only a mobile is present", () => {
  const { skip } = normalizeRecord({ mobile_without_country_code: "9876543210" });
  assert.equal(skip, false);
});

test("rule 2: splits country code out of the mobile number", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    mobile_without_country_code: "+91 9876543210",
  });
  assert.equal(record.country_code, "+91");
  assert.equal(record.mobile_without_country_code, "9876543210");
});

test("rule 2: infers country code from >10 digits without a plus", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    mobile_without_country_code: "919876543210",
  });
  assert.equal(record.country_code, "+91");
  assert.equal(record.mobile_without_country_code, "9876543210");
});

test("rule 3: keeps first email, overflows the rest into crm_note", () => {
  const { record } = normalizeRecord({
    email: "first@x.com, second@x.com; third@x.com",
    mobile_without_country_code: "9876543210",
  });
  assert.equal(record.email, "first@x.com");
  assert.match(record.crm_note, /second@x\.com/);
  assert.match(record.crm_note, /third@x\.com/);
});

test("rule 4: keeps first mobile, overflows the rest into crm_note", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    mobile_without_country_code: "9876543210, 9123456780",
  });
  assert.equal(record.mobile_without_country_code, "9876543210");
  assert.match(record.crm_note, /9123456780/);
});

test("enum coercion: maps a fuzzy status onto an allowed value", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    crm_status: "good lead follow up",
  });
  assert.equal(record.crm_status, "GOOD_LEAD_FOLLOW_UP");
});

test("enum coercion: blanks an unrecognised data_source", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    data_source: "some random source",
  });
  assert.equal(record.data_source, "");
});

test("rule 6: escapes newlines so each record stays one CSV row", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    crm_note: "line one\nline two",
  });
  assert.equal(record.crm_note.includes("\n"), false);
  assert.match(record.crm_note, /line one\\nline two/);
});

test("folds a model-provided _note hint into crm_note", () => {
  const { record } = normalizeRecord({
    email: "a@b.com",
    crm_note: "existing",
    _note: "extra hint",
  });
  assert.match(record.crm_note, /existing/);
  assert.match(record.crm_note, /extra hint/);
});
