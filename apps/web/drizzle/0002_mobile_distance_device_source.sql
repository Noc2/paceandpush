ALTER TABLE distance_days
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES mobile_devices (id);

DROP INDEX IF EXISTS distance_days_source_hash_idx;

CREATE UNIQUE INDEX IF NOT EXISTS distance_days_user_source_hash_idx
  ON distance_days (user_id, source_hash);
