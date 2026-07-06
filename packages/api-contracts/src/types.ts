export type Board = "balanced" | "commits" | "distance";

export type Platform = "ios" | "android";

export type SyncStatus = "success" | "warning" | "error";

export interface ScoreSummary {
  period: string;
  score: number;
  rank: number | null;
  commits: number;
  kilometers: number;
  lastSyncAt: string | null;
}

export interface LeaderboardRow {
  rank: number;
  login: string;
  displayName: string;
  score: number;
  commits: number;
  kilometers: number;
  streakDays: number;
}

export interface LeaderboardResponse {
  period: string;
  board: Board;
  rows: LeaderboardRow[];
}

export interface UserSearchResponse {
  query: string;
  period: string;
  rows: LeaderboardRow[];
}

export interface ProfileHistoryPoint {
  date: string;
  commits: number;
  kilometers: number;
  score: number;
}

export interface PublicProfileResponse {
  login: string;
  displayName: string;
  bio: string | null;
  score: ScoreSummary;
  history: ProfileHistoryPoint[];
}

export interface MeResponse {
  login: string;
  displayName: string;
  publicLeaderboard: boolean;
  units: "metric" | "imperial";
  score: ScoreSummary;
  devices: MobileDeviceSummary[];
}

export interface MobileDeviceSummary {
  id: string;
  platform: Platform;
  label: string;
  lastSeenAt: string | null;
  revoked: boolean;
}

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export interface DeviceExchangeRequest {
  code: string;
  platform: Platform;
  label: string;
}

export interface DeviceExchangeResponse {
  device: MobileDeviceSummary;
  token: string;
}

export interface MobileAuthExchangeRequest {
  code: string;
}

export interface DistanceDayInput {
  date: string;
  /** Running-only distance for this day, in meters. */
  meters: number;
  sourcePlatform: Platform;
  sourceHash: string;
}

export interface DistanceDaysRequest {
  days: DistanceDayInput[];
}

export interface DistanceDaysResponse {
  accepted: number;
  flagged: number;
}

export interface SyncRunRequest {
  platform: Platform;
  status: SyncStatus;
  startedAt: string;
  finishedAt: string | null;
  counters: Record<string, number>;
  errorSummary?: string;
}

export interface SyncRunResponse {
  id: string;
  status: SyncStatus;
}
