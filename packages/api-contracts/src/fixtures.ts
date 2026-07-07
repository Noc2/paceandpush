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
      login: "Noc2",
      displayName: "David Hawig",
      score: 94.2,
      commits: 312,
      kilometers: 86.4,
      streakDays: 11,
    },
    {
      rank: 2,
      login: "alina-dev",
      displayName: "Alina Roth",
      score: 88.7,
      commits: 244,
      kilometers: 97.8,
      streakDays: 8,
    },
    {
      rank: 3,
      login: "mjansen",
      displayName: "Mika Jansen",
      score: 77.1,
      commits: 178,
      kilometers: 73.2,
      streakDays: 5,
    },
    {
      rank: 4,
      login: "ship-patch",
      displayName: "Sam Patel",
      score: 71.8,
      commits: 421,
      kilometers: 31.9,
      streakDays: 2,
    },
    {
      rank: 5,
      login: "irunlint",
      displayName: "Iris Kim",
      score: 69.6,
      commits: 133,
      kilometers: 102,
      streakDays: 9,
    },
  ],
};

export const seedMe: MeResponse = {
  login: "Noc2",
  displayName: "David Hawig",
  publicLeaderboard: true,
  units: "metric",
  score: {
    period: "2026-07",
    score: 94.2,
    rank: 1,
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
  score: seedMe.score,
  history: [
    { date: "2026-07-01", commits: 41, kilometers: 8.1, score: 42.8 },
    { date: "2026-07-02", commits: 93, kilometers: 23.5, score: 68.4 },
    { date: "2026-07-03", commits: 128, kilometers: 31.2, score: 75.6 },
    { date: "2026-07-04", commits: 176, kilometers: 43.8, score: 80.9 },
    { date: "2026-07-05", commits: 219, kilometers: 58.7, score: 86.3 },
    { date: "2026-07-06", commits: 260, kilometers: 71.5, score: 90.4 },
    { date: "2026-07-07", commits: 312, kilometers: 86.4, score: 94.2 },
  ],
};
