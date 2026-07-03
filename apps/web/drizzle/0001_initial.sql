CREATE TYPE platform AS ENUM ('ios', 'android');
CREATE TYPE sync_status AS ENUM ('success', 'warning', 'error');
CREATE TYPE board AS ENUM ('balanced', 'commits', 'distance');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id text NOT NULL,
  login text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  public_leaderboard boolean NOT NULL DEFAULT false,
  units text NOT NULL DEFAULT 'metric',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_github_id_idx ON users (github_id);
CREATE UNIQUE INDEX users_login_idx ON users (login);

CREATE TABLE github_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  github_id text NOT NULL,
  login text NOT NULL,
  access_token_hash text,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX github_accounts_user_id_idx ON github_accounts (user_id);
CREATE UNIQUE INDEX github_accounts_github_id_idx ON github_accounts (github_id);

CREATE TABLE mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  platform platform NOT NULL,
  label text NOT NULL,
  token_hash text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mobile_devices_token_hash_idx ON mobile_devices (token_hash);
CREATE INDEX mobile_devices_user_id_idx ON mobile_devices (user_id);

CREATE TABLE commit_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  day date NOT NULL,
  commit_count integer NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX commit_days_user_day_idx ON commit_days (user_id, day);

CREATE TABLE distance_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  device_id uuid REFERENCES mobile_devices (id),
  day date NOT NULL,
  meters integer NOT NULL,
  source_platform platform NOT NULL,
  source_hash text NOT NULL,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX distance_days_user_day_idx ON distance_days (user_id, day);
CREATE UNIQUE INDEX distance_days_user_source_hash_idx ON distance_days (user_id, source_hash);

CREATE TABLE score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  period text NOT NULL,
  board board NOT NULL DEFAULT 'balanced',
  commit_total integer NOT NULL,
  distance_meters_total integer NOT NULL,
  normalized_commits numeric(8, 6) NOT NULL,
  normalized_kilometers numeric(8, 6) NOT NULL,
  balanced_score numeric(5, 2) NOT NULL,
  rank integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX score_snapshots_user_period_board_idx
  ON score_snapshots (user_id, period, board);

CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  device_id uuid REFERENCES mobile_devices (id),
  platform platform NOT NULL,
  status sync_status NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  counters jsonb NOT NULL DEFAULT '{}',
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
