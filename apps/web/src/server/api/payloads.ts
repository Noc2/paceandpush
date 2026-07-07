import type {
  DistanceDayInput,
  Platform,
  SyncRunRequest,
  SyncStatus,
} from "@paceandpush/api-contracts";

export type AccountSettingsPatch = Partial<{
  publicLeaderboard: boolean;
  units: "metric" | "imperial";
}>;

export function isAccountSettingsPatch(value: unknown): value is AccountSettingsPatch {
  return isPlainObject(value);
}

export function isDistanceDayInput(
  value: unknown,
  expectedPlatform: Platform,
): value is DistanceDayInput {
  if (!isPlainObject(value)) return false;

  const day = typeof value.date === "string" ? value.date : "";
  const meters = value.meters;
  const sourceHash = value.sourceHash;
  const date =
    day.length > 0
      ? new Date(`${day}T00:00:00.000Z`)
      : null;

  return (
    Boolean(date) &&
    Number.isFinite(date?.valueOf()) &&
    date?.toISOString().slice(0, 10) === day &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    typeof meters === "number" &&
    Number.isFinite(meters) &&
    meters >= 0 &&
    meters <= 250_000 &&
    value.sourcePlatform === expectedPlatform &&
    typeof sourceHash === "string" &&
    sourceHash.length >= 8
  );
}

export function isSyncRunRequest(
  value: unknown,
  expectedPlatform: Platform,
): value is SyncRunRequest {
  if (!isPlainObject(value) || !isPlainObject(value.counters)) return false;

  const startedAt = typeof value.startedAt === "string" ? Date.parse(value.startedAt) : NaN;
  const finishedAt =
    value.finishedAt == null
      ? null
      : typeof value.finishedAt === "string"
        ? Date.parse(value.finishedAt)
        : NaN;
  const counters = Object.entries(value.counters);

  return (
    value.platform === expectedPlatform &&
    isSyncStatus(value.status) &&
    Number.isFinite(startedAt) &&
    (finishedAt === null || (Number.isFinite(finishedAt) && finishedAt >= startedAt)) &&
    counters.length <= 20 &&
    counters.every(
      ([, counter]) => typeof counter === "number" && Number.isFinite(counter) && counter >= 0,
    ) &&
    (value.errorSummary == null ||
      (typeof value.errorSummary === "string" && value.errorSummary.length <= 500))
  );
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSyncStatus(status: unknown): status is SyncStatus {
  return status === "success" || status === "warning" || status === "error";
}
