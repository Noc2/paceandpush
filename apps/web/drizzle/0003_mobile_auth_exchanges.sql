CREATE TABLE IF NOT EXISTS mobile_auth_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  platform platform NOT NULL,
  label text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mobile_auth_exchanges_code_hash_idx
  ON mobile_auth_exchanges (code_hash);

CREATE INDEX IF NOT EXISTS mobile_auth_exchanges_user_id_idx
  ON mobile_auth_exchanges (user_id);
