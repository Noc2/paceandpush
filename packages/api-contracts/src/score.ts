export const scoreModel = "fixed-plateau-v1" as const;
export const weeklyCommitPlateau = 25;
export const weeklyKilometerPlateau = 50;

const plateauBase = 25;
const daysPerWeek = 7;

export interface ScoreInput {
  commits: number;
  kilometers: number;
}

export interface ActivityScore extends ScoreInput {
  commitComponent: number;
  distanceComponent: number;
  score: number;
}

export interface ScorePlateaus {
  commits: number;
  kilometers: number;
}

export function scorePlateaus(periodDays: number): ScorePlateaus {
  if (!Number.isInteger(periodDays) || periodDays <= 0) {
    throw new RangeError("periodDays must be a positive integer.");
  }

  return {
    commits: weeklyCommitPlateau * periodDays / daysPerWeek,
    kilometers: weeklyKilometerPlateau * periodDays / daysPerWeek,
  };
}

export function scoreActivity({
  commits,
  kilometers,
  periodDays,
}: ScoreInput & { periodDays: number }): ActivityScore {
  const plateaus = scorePlateaus(periodDays);
  const commitComponent = scoreComponent(commits, plateaus.commits);
  const distanceComponent = scoreComponent(kilometers, plateaus.kilometers);

  return {
    commits,
    kilometers,
    commitComponent,
    distanceComponent,
    score: Math.sqrt(commitComponent * distanceComponent) * 100,
  };
}

export function scoreComponent(value: number, plateau: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(plateau) || plateau <= 0) return 0;

  const component = -Math.expm1(-Math.log(plateauBase) * value / plateau);
  return Math.min(Math.max(component, 0), 1);
}
