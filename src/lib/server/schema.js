import { z } from "zod";
import {
  CRM_FIELD_KEYS,
  ALLOWED_CRM_STATUS,
  ALLOWED_DATA_SOURCE,
} from "../constants.js";

/**
 * Zod schema for a single CRM record returned by the LLM.
 *
 * The model is instructed to emit every field (empty string when unknown), but
 * we keep each field optional + defaulted so a slightly-off response still
 * validates instead of forcing a whole batch into the retry/fallback path.
 * Post-validation, `normalizeRecord` is responsible for enum coercion and the
 * business rules — the schema only guarantees shape and types.
 */
const recordShape = CRM_FIELD_KEYS.reduce((shape, key) => {
  shape[key] = z.string().optional().default("");
  return shape;
}, {});

// `.catchall("")` is intentionally omitted: unknown keys are stripped so the
// LLM can't smuggle arbitrary fields into our CRM objects.
export const CrmRecordSchema = z.object(recordShape).strip();

/**
 * The batch envelope we ask the LLM to return: a `records` array whose length
 * and order match the input rows 1:1. `_skip`/`_note` are optional hints the
 * model may add; the authoritative skip/append decisions are re-derived in
 * `normalize.js` so we never trust the model on the business rules alone.
 */
export const CrmBatchSchema = z.object({
  records: z.array(
    CrmRecordSchema.extend({
      _skip: z.boolean().optional(),
      _note: z.string().optional(),
    })
  ),
});

export const STATUS_VALUES = ALLOWED_CRM_STATUS;
export const SOURCE_VALUES = ALLOWED_DATA_SOURCE;
