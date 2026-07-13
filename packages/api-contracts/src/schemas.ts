export const contractVersion = "2026-07-13-private-sync-timestamps";

export const jsonSchemas = {
  scoreSummary: {
    type: "object",
    required: ["period", "score", "rank", "commits", "kilometers", "lastSyncAt"],
    properties: {
      period: { type: "string", pattern: "^(?:\\d{4}|\\d{4}-(?:0[1-9]|1[0-2])|\\d{4}-W(?:0[1-9]|[1-4]\\d|5[0-3]))$" },
      score: { type: "number" },
      rank: { type: ["number", "null"] },
      commits: { type: "number" },
      kilometers: { type: "number" },
      lastSyncAt: { type: ["string", "null"], format: "date-time" },
    },
  },
  publicScoreSummary: {
    type: "object",
    additionalProperties: false,
    required: ["period", "score", "rank", "commits", "kilometers"],
    properties: {
      period: { type: "string", pattern: "^(?:\\d{4}|\\d{4}-(?:0[1-9]|1[0-2])|\\d{4}-W(?:0[1-9]|[1-4]\\d|5[0-3]))$" },
      score: { type: "number" },
      rank: { type: ["number", "null"] },
      commits: { type: "number" },
      kilometers: { type: "number" },
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
      date: {
        type: "string",
        format: "date",
        description: "UTC calendar day in YYYY-MM-DD format.",
      },
      meters: {
        type: "number",
        minimum: 0,
        maximum: 250000,
        description:
          "Running-only distance for this UTC day, in meters. Values over 100000 are accepted but flagged as implausible.",
      },
      sourcePlatform: { enum: ["ios", "android"] },
      sourceHash: { type: "string", minLength: 8 },
    },
  },
  distanceDaysRequest: {
    type: "object",
    required: ["days"],
    properties: {
      days: {
        type: "array",
        maxItems: 45,
        items: {
          type: "object",
          required: ["date", "meters", "sourcePlatform", "sourceHash"],
          properties: {
            date: {
              type: "string",
              format: "date",
              description: "UTC calendar day in YYYY-MM-DD format.",
            },
            meters: {
              type: "number",
              minimum: 0,
              maximum: 250000,
              description:
                "Running-only distance for this UTC day, in meters. Values over 100000 are accepted but flagged as implausible.",
            },
            sourcePlatform: { enum: ["ios", "android"] },
            sourceHash: { type: "string", minLength: 8 },
          },
        },
      },
    },
  },
} as const;
