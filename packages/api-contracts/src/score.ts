export interface ScoreInput {
  commits: number;
  kilometers: number;
}

export interface NormalizedScoreInput extends ScoreInput {
  normalizedCommits: number;
  normalizedKilometers: number;
}

export function normalizeMetric(value: number, maxValue: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;
  return Math.min(value / maxValue, 1);
}

export function balancedScore({
  normalizedCommits,
  normalizedKilometers,
}: Pick<NormalizedScoreInput, "normalizedCommits" | "normalizedKilometers">): number {
  const commitPart = Math.max(normalizedCommits, 0);
  const distancePart = Math.max(normalizedKilometers, 0);
  return roundScore(Math.sqrt(commitPart * distancePart) * 100);
}

export function scoreCohort<T extends ScoreInput>(
  rows: T[],
): Array<T & NormalizedScoreInput & { score: number }> {
  const maxCommits = Math.max(...rows.map((row) => row.commits), 0);
  const maxKilometers = Math.max(...rows.map((row) => row.kilometers), 0);

  return rows.map((row) => {
    const normalizedCommits = normalizeMetric(row.commits, maxCommits);
    const normalizedKilometers = normalizeMetric(row.kilometers, maxKilometers);
    return {
      ...row,
      normalizedCommits,
      normalizedKilometers,
      score: balancedScore({ normalizedCommits, normalizedKilometers }),
    };
  });
}

export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
