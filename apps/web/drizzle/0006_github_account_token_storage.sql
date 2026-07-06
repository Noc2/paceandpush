ALTER TABLE github_accounts
  ADD COLUMN IF NOT EXISTS access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS access_token_encryption_key_id text,
  ADD COLUMN IF NOT EXISTS access_token_encrypted_at timestamptz;
