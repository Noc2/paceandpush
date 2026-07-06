CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS users_public_search_trgm_idx
  ON users USING gin (
    (lower(login || ' ' || display_name || ' ' || coalesce(bio, ''))) gin_trgm_ops
  )
  WHERE public_leaderboard = true;
