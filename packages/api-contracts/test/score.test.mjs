import assert from "node:assert/strict";
import test from "node:test";
import {
  scoreActivity,
  scoreComponent,
  scoreModel,
  scorePlateaus,
  weeklyCommitPlateau,
  weeklyKilometerPlateau,
} from "../src/score.ts";
import { seedLeaderboard, seedProfile } from "../src/fixtures.ts";

const epsilon = 1e-10;

function closeTo(actual, expected, tolerance = epsilon) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test("fixed score model publishes weekly plateau constants", () => {
  assert.equal(scoreModel, "fixed-plateau-v1");
  assert.equal(weeklyCommitPlateau, 25);
  assert.equal(weeklyKilometerPlateau, 50);
  assert.deepEqual(scorePlateaus(7), { commits: 25, kilometers: 50 });
});

test("half and full plateau activity produce 80 and 96 components", () => {
  closeTo(scoreComponent(12.5, 25), 0.8);
  closeTo(scoreComponent(25, 25), 0.96);

  const halfPlateau = scoreActivity({ commits: 12.5, kilometers: 25, periodDays: 7 });
  const fullPlateau = scoreActivity({ commits: 25, kilometers: 50, periodDays: 7 });
  closeTo(halfPlateau.score, 80);
  closeTo(fullPlateau.score, 96);
});

test("score is independent of cohort membership and outliers", () => {
  const honestInput = { commits: 18, kilometers: 32, periodDays: 7 };
  const before = scoreActivity(honestInput);
  const cohort = [
    scoreActivity(honestInput),
    scoreActivity({ commits: 800, kilometers: 160, periodDays: 7 }),
  ];

  assert.deepEqual(cohort[0], before);
});

test("score is monotonic with diminishing returns", () => {
  const low = scoreActivity({ commits: 10, kilometers: 10, periodDays: 7 }).score;
  const moreRunning = scoreActivity({ commits: 10, kilometers: 20, periodDays: 7 }).score;
  const mostRunning = scoreActivity({ commits: 10, kilometers: 30, periodDays: 7 }).score;

  assert.ok(moreRunning > low);
  assert.ok(mostRunning > moreRunning);
  assert.ok(moreRunning - low > mostRunning - moreRunning);
});

test("zero on either axis keeps the balanced score at zero", () => {
  assert.equal(scoreActivity({ commits: 25, kilometers: 0, periodDays: 7 }).score, 0);
  assert.equal(scoreActivity({ commits: 0, kilometers: 50, periodDays: 7 }).score, 0);
});

test("complete-period scaling preserves equivalent activity rates", () => {
  const week = scoreActivity({ commits: 18, kilometers: 32, periodDays: 7 });
  const fourWeeks = scoreActivity({ commits: 72, kilometers: 128, periodDays: 28 });

  closeTo(fourWeeks.commitComponent, week.commitComponent);
  closeTo(fourWeeks.distanceComponent, week.distanceComponent);
  closeTo(fourWeeks.score, week.score);
});

test("calendar period plateaus scale for leap days and full years", () => {
  closeTo(scorePlateaus(29).commits, 25 * 29 / 7);
  closeTo(scorePlateaus(31).kilometers, 50 * 31 / 7);
  closeTo(scorePlateaus(365).commits, 25 * 365 / 7);
  closeTo(scorePlateaus(366).kilometers, 50 * 366 / 7);
});

test("invalid activity stays finite and invalid period lengths are rejected", () => {
  const score = scoreActivity({ commits: Number.NaN, kilometers: -10, periodDays: 7 });
  assert.deepEqual(score, {
    commits: Number.NaN,
    kilometers: -10,
    commitComponent: 0,
    distanceComponent: 0,
    score: 0,
  });
  assert.throws(() => scorePlateaus(0), /positive integer/);
  assert.throws(() => scorePlateaus(7.5), /positive integer/);
});

test("published fixtures use fixed-plateau scores and deterministic ranks", () => {
  for (const row of seedLeaderboard.rows) {
    const expected = scoreActivity({
      commits: row.commits,
      kilometers: row.kilometers,
      periodDays: 31,
    });
    closeTo(row.score, expected.score, 1e-6);
  }

  assert.deepEqual(seedLeaderboard.rows.map((row) => row.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    seedLeaderboard.rows.map((row) => row.score),
    [...seedLeaderboard.rows.map((row) => row.score)].sort((left, right) => right - left),
  );

  const finalHistoryPoint = seedProfile.history.at(-1);
  assert.ok(finalHistoryPoint);
  closeTo(finalHistoryPoint.score, seedProfile.score.score, 1e-6);
});
