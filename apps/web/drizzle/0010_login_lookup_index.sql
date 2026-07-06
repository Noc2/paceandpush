DROP INDEX IF EXISTS users_login_idx;

CREATE INDEX IF NOT EXISTS users_login_idx
  ON users (login);
