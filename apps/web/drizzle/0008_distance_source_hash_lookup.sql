DROP INDEX IF EXISTS distance_days_user_source_hash_idx;

CREATE INDEX IF NOT EXISTS distance_days_user_source_hash_idx
  ON distance_days (user_id, source_hash);
