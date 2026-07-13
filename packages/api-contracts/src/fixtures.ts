import type {
  LeaderboardResponse,
  MeResponse,
  PublicProfileResponse,
} from "./types";

export const seedLeaderboard: LeaderboardResponse = {
  period: "2026-07",
  board: "balanced",
  rows: [
    {
      rank: 1,
      login: "alina-dev",
      displayName: "Alina Roth",
      score: 87.067096,
      commits: 244,
      kilometers: 97.8,
      streakDays: 8,
    },
    {
      rank: 2,
      login: "irunlint",
      displayName: "Iris Kim",
      score: 86.995099,
      commits: 133,
      kilometers: 102,
      streakDays: 9,
    },
    {
      rank: 3,
      login: "Noc2",
      displayName: "David Hawig",
      score: 84.564915,
      commits: 312,
      kilometers: 86.4,
      streakDays: 11,
    },
    {
      rank: 4,
      login: "mjansen",
      displayName: "Mika Jansen",
      score: 80.700491,
      commits: 178,
      kilometers: 73.2,
      streakDays: 5,
    },
    {
      rank: 5,
      login: "ship-patch",
      displayName: "Sam Patel",
      score: 60.914876,
      commits: 421,
      kilometers: 31.9,
      streakDays: 2,
    },
  ],
};

export const seedMe: MeResponse = {
  login: "Noc2",
  displayName: "David Hawig",
  publicLeaderboard: true,
  publicActivityHistory: true,
  publicHealthDataConsentVersion: "public-health-v1",
  publicHealthDataConsentedAt: "2026-07-03T13:40:00.000Z",
  streakDays: 11,
  units: "metric",
  score: {
    period: "2026-07",
    score: 84.564915,
    rank: 3,
    commits: 312,
    kilometers: 86.4,
    lastSyncAt: "2026-07-03T13:45:00.000Z",
  },
  github: {
    connected: true,
    needsReconnect: false,
    updatedAt: "2026-07-03T13:45:00.000Z",
  },
  devices: [],
};

export const seedProfile: PublicProfileResponse = {
  login: "Noc2",
  displayName: "David Hawig",
  bio: "Run. Commit. Repeat.",
  score: {
    period: seedMe.score.period,
    score: seedMe.score.score,
    rank: seedMe.score.rank,
    commits: seedMe.score.commits,
    kilometers: seedMe.score.kilometers,
  },
  history: [
    { date: "2026-07-01", commits: 41, kilometers: 8.1, score: 27.812892 },
    { date: "2026-07-02", commits: 93, kilometers: 23.5, score: 51.962108 },
    { date: "2026-07-03", commits: 128, kilometers: 31.2, score: 59.649612 },
    { date: "2026-07-04", commits: 176, kilometers: 43.8, score: 68.421428 },
    { date: "2026-07-05", commits: 219, kilometers: 58.7, score: 75.69765 },
    { date: "2026-07-06", commits: 260, kilometers: 71.5, score: 80.37357 },
    { date: "2026-07-07", commits: 312, kilometers: 86.4, score: 84.564915 },
  ],
  historyVisibility: "public",
};
