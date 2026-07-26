CREATE TABLE IF NOT EXISTS period_scores (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period text NOT NULL,
  commit_total integer NOT NULL CHECK (commit_total >= 0),
  distance_meters_total integer NOT NULL CHECK (distance_meters_total >= 0),
  commit_component numeric(8, 6) NOT NULL,
  distance_component numeric(8, 6) NOT NULL,
  score numeric(9, 6) NOT NULL,
  streak_days integer NOT NULL CHECK (streak_days >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

CREATE INDEX IF NOT EXISTS period_scores_balanced_order_idx
  ON period_scores (
    period,
    score DESC,
    commit_total DESC,
    distance_meters_total DESC,
    user_id
  );

CREATE INDEX IF NOT EXISTS period_scores_commit_order_idx
  ON period_scores (
    period,
    commit_total DESC,
    distance_meters_total DESC,
    user_id
  );

CREATE INDEX IF NOT EXISTS period_scores_distance_order_idx
  ON period_scores (
    period,
    distance_meters_total DESC,
    commit_total DESC,
    user_id
  );

CREATE TABLE IF NOT EXISTS dirty_score_periods (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  period text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period)
);

CREATE INDEX IF NOT EXISTS dirty_score_periods_requested_at_idx
  ON dirty_score_periods (requested_at);

CREATE OR REPLACE FUNCTION mark_score_periods_dirty()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_day date;
  affected_user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF TG_TABLE_NAME = 'commit_days'
      AND NEW.commit_count IS NOT DISTINCT FROM OLD.commit_count THEN
      RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'distance_days'
      AND NEW.meters IS NOT DISTINCT FROM OLD.meters
      AND NEW.flagged IS NOT DISTINCT FROM OLD.flagged THEN
      RETURN NEW;
    END IF;
  END IF;

  affected_day := CASE WHEN TG_OP = 'DELETE' THEN OLD.day ELSE NEW.day END;
  affected_user_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

  INSERT INTO dirty_score_periods (user_id, period)
  VALUES
    (affected_user_id, to_char(affected_day, 'IYYY-"W"IW')),
    (affected_user_id, to_char(affected_day, 'YYYY-MM')),
    (affected_user_id, to_char(affected_day, 'YYYY'))
  ON CONFLICT (user_id, period)
  DO UPDATE SET
    revision = dirty_score_periods.revision + 1,
    requested_at = now();

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS commit_days_mark_score_periods_dirty ON commit_days;
CREATE TRIGGER commit_days_mark_score_periods_dirty
AFTER INSERT OR UPDATE OR DELETE ON commit_days
FOR EACH ROW EXECUTE FUNCTION mark_score_periods_dirty();

DROP TRIGGER IF EXISTS distance_days_mark_score_periods_dirty ON distance_days;
CREATE TRIGGER distance_days_mark_score_periods_dirty
AFTER INSERT OR UPDATE OR DELETE ON distance_days
FOR EACH ROW EXECUTE FUNCTION mark_score_periods_dirty();

INSERT INTO dirty_score_periods (user_id, period)
SELECT activity_days.user_id, periods.period
FROM (
  SELECT user_id, day FROM commit_days
  UNION
  SELECT user_id, day FROM distance_days
) AS activity_days
CROSS JOIN LATERAL (
  VALUES
    (to_char(activity_days.day, 'IYYY-"W"IW')),
    (to_char(activity_days.day, 'YYYY-MM')),
    (to_char(activity_days.day, 'YYYY'))
) AS periods(period)
GROUP BY activity_days.user_id, periods.period
ON CONFLICT (user_id, period)
DO UPDATE SET
  revision = dirty_score_periods.revision + 1,
  requested_at = now();

DROP TABLE IF EXISTS score_snapshots;
DROP TYPE IF EXISTS board;
