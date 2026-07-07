ALTER TABLE "mobile_auth_exchanges"
  ADD COLUMN IF NOT EXISTS "code_challenge" text;
