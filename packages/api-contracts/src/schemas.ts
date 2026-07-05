export const contractVersion = "2026-07-05";

export const jsonSchemas = {
  scoreSummary: {
    type: "object",
    required: ["period", "score", "rank", "commits", "kilometers", "lastSyncAt"],
    properties: {
      period: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
      score: { type: "number" },
      rank: { type: ["number", "null"] },
      commits: { type: "number" },
      kilometers: { type: "number" },
      lastSyncAt: { type: ["string", "null"], format: "date-time" },
    },
  },
  leaderboardRow: {
    type: "object",
    required: ["rank", "login", "displayName", "score", "commits", "kilometers", "streakDays"],
    properties: {
      rank: { type: "number" },
      login: { type: "string" },
      displayName: { type: "string" },
      score: { type: "number" },
      commits: { type: "number" },
      kilometers: { type: "number" },
      streakDays: { type: "number" },
    },
  },
  distanceDayInput: {
    type: "object",
    required: ["date", "meters", "sourcePlatform", "sourceHash"],
    properties: {
      date: { type: "string", format: "date" },
      meters: { type: "number", minimum: 0, description: "Running-only distance for this day, in meters." },
      sourcePlatform: { enum: ["ios", "android"] },
      sourceHash: { type: "string", minLength: 8 },
    },
  },
} as const;
