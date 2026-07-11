ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_activity_history boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_health_data_consent_version text,
  ADD COLUMN IF NOT EXISTS public_health_data_consented_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS public_health_data_consent_revoked_at timestamp with time zone;

-- Earlier visibility choices did not identify the disclosure the user accepted.
-- Require a fresh, versioned opt-in before publishing health-derived totals again.
UPDATE users
SET
  public_leaderboard = false,
  public_activity_history = false,
  public_health_data_consent_revoked_at = now()
WHERE public_leaderboard = true;

ALTER TABLE users
  ADD CONSTRAINT users_public_activity_history_requires_public
    CHECK (NOT public_activity_history OR public_leaderboard),
  ADD CONSTRAINT users_public_health_data_consent_required
    CHECK (
      NOT public_leaderboard OR (
        public_health_data_consent_version IS NOT NULL AND
        public_health_data_consented_at IS NOT NULL AND
        public_health_data_consent_revoked_at IS NULL
      )
    );
