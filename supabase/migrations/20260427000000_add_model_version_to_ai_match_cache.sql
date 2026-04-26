-- Add model_version column to ai_match_cache for traceability across Gemini model changes.
-- Idempotent: ADD COLUMN IF NOT EXISTS ensures this is safe to re-run.

alter table ai_match_cache
  add column if not exists model_version text default null;

-- No backfill: legacy entries retain NULL and are accepted as valid by all readers.
-- A maintenance script can selectively delete stale entries by model version if needed:
--   DELETE FROM ai_match_cache WHERE model_version = 'gemini-2.0-flash';
--
-- No NOT NULL constraint: adding NOT NULL without a default would require a full-table
-- rewrite and would break reads of existing rows. NULL = "legacy, unknown model".
--
-- No index: filtering by model_version is not a hot query path. Add index separately
-- if needed once observability data shows it would benefit query performance.
