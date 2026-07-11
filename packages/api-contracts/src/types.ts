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
  github: GitHubConnectionSummary;
  devices: MobileDeviceSummary[];
}

export interface GitHubConnectionSummary {
  connected: boolean;
  needsReconnect: boolean;
  updatedAt: string | null;
}

export interface GitHubDisconnectResponse {
  login: string;
  github: GitHubConnectionSummary;
  device: MobileDeviceSummary;
  disconnectedAt: string;
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
  publicLeaderboard?: boolean;
}

export interface DeviceExchangeResponse {
  device: MobileDeviceSummary;
  token: string;
  publicLeaderboard: boolean;
}

export interface MobileAuthExchangeRequest {
  code: string;
  codeVerifier: string;
  publicLeaderboard?: boolean;
}

export interface DistanceDayInput {
  /** UTC calendar day in YYYY-MM-DD format. */
  date: string;
  /** Running-only distance for this UTC day, in meters. */
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
  warnings?: string[];
}

export interface SyncRunRequest {
  platform: Platform;
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string | null;
  counters: Record<string, number>;
  errorSummary?: string | null;
}

export interface SyncRunResponse {
  id: string;
  status: SyncStatus;
}
