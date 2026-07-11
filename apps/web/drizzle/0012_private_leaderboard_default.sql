ALTER TABLE users
  ALTER COLUMN public_leaderboard SET DEFAULT false;

-- The previous default did not distinguish explicit opt-ins from implicit
-- publication. Reset every existing account so public visibility requires a
-- fresh, affirmative choice.
UPDATE users
SET public_leaderboard = false
WHERE public_leaderboard = true;
