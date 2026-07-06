CREATE INDEX IF NOT EXISTS score_snapshots_period_board_rank_idx
  ON score_snapshots (period, board, rank)
  WHERE rank IS NOT NULL;

CREATE INDEX IF NOT EXISTS sync_runs_user_started_at_idx
  ON sync_runs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS commit_days_day_user_idx
  ON commit_days (day, user_id);

CREATE INDEX IF NOT EXISTS distance_days_day_user_unflagged_idx
  ON distance_days (day, user_id)
  WHERE flagged = false;

CREATE INDEX IF NOT EXISTS users_login_lower_idx
  ON users (lower(login));
