import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["ios", "android"]);
export const syncStatusEnum = pgEnum("sync_status", ["success", "warning", "error"]);
export const boardEnum = pgEnum("board", ["balanced", "commits", "distance"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    githubId: text("github_id").notNull(),
    login: text("login").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    publicLeaderboard: boolean("public_leaderboard").notNull().default(false),
    units: text("units").notNull().default("metric"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    githubIdIdx: uniqueIndex("users_github_id_idx").on(table.githubId),
    loginIdx: uniqueIndex("users_login_idx").on(table.login),
  }),
);

export const githubAccounts = pgTable(
  "github_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    githubId: text("github_id").notNull(),
    login: text("login").notNull(),
    accessTokenHash: text("access_token_hash"),
    scopes: text("scopes").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex("github_accounts_user_id_idx").on(table.userId),
    githubIdx: uniqueIndex("github_accounts_github_id_idx").on(table.githubId),
  }),
);

export const mobileDevices = pgTable(
  "mobile_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    platform: platformEnum("platform").notNull(),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    revoked: boolean("revoked").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("mobile_devices_token_hash_idx").on(table.tokenHash),
    userIdx: index("mobile_devices_user_id_idx").on(table.userId),
  }),
);

export const mobileAuthExchanges = pgTable(
  "mobile_auth_exchanges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    platform: platformEnum("platform").notNull(),
    label: text("label").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeHashIdx: uniqueIndex("mobile_auth_exchanges_code_hash_idx").on(table.codeHash),
    userIdx: index("mobile_auth_exchanges_user_id_idx").on(table.userId),
  }),
);

export const commitDays = pgTable(
  "commit_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    day: date("day").notNull(),
    commitCount: integer("commit_count").notNull(),
    sourceMetadata: jsonb("source_metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDayIdx: uniqueIndex("commit_days_user_day_idx").on(table.userId, table.day),
  }),
);

export const distanceDays = pgTable(
  "distance_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    deviceId: uuid("device_id").references(() => mobileDevices.id),
    day: date("day").notNull(),
    meters: integer("meters").notNull(),
    sourcePlatform: platformEnum("source_platform").notNull(),
    sourceHash: text("source_hash").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userDayIdx: uniqueIndex("distance_days_user_day_idx").on(table.userId, table.day),
    sourceHashIdx: uniqueIndex("distance_days_user_source_hash_idx").on(
      table.userId,
      table.sourceHash,
    ),
  }),
);

export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    period: text("period").notNull(),
    board: boardEnum("board").notNull().default("balanced"),
    commitTotal: integer("commit_total").notNull(),
    distanceMetersTotal: integer("distance_meters_total").notNull(),
    normalizedCommits: numeric("normalized_commits", { precision: 8, scale: 6 }).notNull(),
    normalizedKilometers: numeric("normalized_kilometers", { precision: 8, scale: 6 }).notNull(),
    balancedScore: numeric("balanced_score", { precision: 5, scale: 2 }).notNull(),
    rank: integer("rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPeriodBoardIdx: uniqueIndex("score_snapshots_user_period_board_idx").on(
      table.userId,
      table.period,
      table.board,
    ),
  }),
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  deviceId: uuid("device_id").references(() => mobileDevices.id),
  platform: platformEnum("platform").notNull(),
  status: syncStatusEnum("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  counters: jsonb("counters").notNull().default({}),
  errorSummary: text("error_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
