DROP TABLE IF EXISTS score_snapshots;

CREATE TABLE score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  period text NOT NULL,
  board board NOT NULL DEFAULT 'balanced',
  commit_total integer NOT NULL,
  distance_meters_total integer NOT NULL,
  commit_component numeric(8, 6) NOT NULL,
  distance_component numeric(8, 6) NOT NULL,
  score numeric(9, 6) NOT NULL,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS score_snapshots_user_period_board_idx
  ON score_snapshots (user_id, period, board);

CREATE INDEX IF NOT EXISTS score_snapshots_period_board_rank_idx
  ON score_snapshots (period, board, rank)
  WHERE rank IS NOT NULL;
