import { createHash, randomBytes } from "node:crypto";
import type {
  DeviceExchangeRequest,
  DeviceExchangeResponse,
  DistanceDayInput,
  Platform,
  MobileDeviceSummary,
  PairingCodeResponse,
  SyncRunRequest,
  SyncRunResponse,
} from "@paceandpush/api-contracts";
import { updateAccountSettings } from "@/server/data/accounts";
import { invalidatePublicDiscoveryCache } from "@/server/data/public-discovery-cache";
import { refreshScoresAfterLeaderboardVisibilityChange } from "@/server/data/scores";
import { getDb } from "@/server/db/client";
import {
  distanceDays,
  mobileAuthExchanges,
  mobileDevices,
  syncRuns,
  users,
} from "@/server/db/schema";
import {
  assertPlatform,
  createDeviceExchange,
  codeChallengeForVerifier,
  decodeDeviceToken,
  hashMobileToken,
  isPKCECodeVerifier,
  normalizeDeviceLabel,
} from "@/server/mobile/tokens";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

const manualPairingCodeTtlMs = 10 * 60 * 1000;

export interface VerifiedMobileDevice {
  user: {
    id: string;
    githubId: string;
    login: string;
    displayName: string;
    avatarUrl: string | null;
  };
  device: MobileDeviceSummary;
}

export async function persistMobileDevice({
  deviceExchange,
  githubId,
}: {
  deviceExchange: DeviceExchangeResponse;
  githubId: string;
}): Promise<void> {
  const [user] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.githubId, githubId))
    .limit(1);

  if (!user) {
    throw new Error("Pairing user does not exist.");
  }

  await getDb().insert(mobileDevices).values({
    id: deviceExchange.device.id,
    userId: user.id,
    platform: deviceExchange.device.platform,
    label: deviceExchange.device.label,
    tokenHash: hashMobileToken(deviceExchange.token),
    lastSeenAt: deviceExchange.device.lastSeenAt
      ? new Date(deviceExchange.device.lastSeenAt)
      : new Date(),
  });
}

export async function createMobileAuthExchange({
  userId,
  platform,
  label,
  codeChallenge,
}: {
  userId: string;
  platform: Platform;
  label: string;
  codeChallenge: string;
}): Promise<string> {
  const code = `pp_mob_exchange_${randomBytes(32).toString("base64url")}`;
  await getDb().insert(mobileAuthExchanges).values({
    userId,
    platform,
    label,
    codeHash: hashMobileAuthCode(code),
    codeChallenge,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return code;
}

export async function createMobilePairingCode({
  userId,
  ttlMs = manualPairingCodeTtlMs,
}: {
  userId: string;
  ttlMs?: number;
}): Promise<PairingCodeResponse> {
  const code = `pp_pair.${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + ttlMs);
  await getDb().insert(mobileAuthExchanges).values({
    userId,
    codeHash: hashMobileAuthCode(code),
    expiresAt,
  });

  return {
    code,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function exchangeMobileAuthCode({
  code,
  codeVerifier,
  publicLeaderboard,
  publicHealthDataConsent,
}: {
  code: string;
  codeVerifier: string;
  publicLeaderboard: boolean;
  publicHealthDataConsent?: DeviceExchangeRequest["publicHealthDataConsent"];
}): Promise<DeviceExchangeResponse> {
  if (!isPKCECodeVerifier(codeVerifier)) {
    throw new Error("Code verifier is invalid.");
  }

  const now = new Date();
  const codeChallenge = codeChallengeForVerifier(codeVerifier);
  const [exchange] = await getDb()
    .update(mobileAuthExchanges)
    .set({ consumedAt: now })
    .where(
      and(
        eq(mobileAuthExchanges.codeHash, hashMobileAuthCode(code)),
        eq(mobileAuthExchanges.codeChallenge, codeChallenge),
        isNull(mobileAuthExchanges.consumedAt),
        gt(mobileAuthExchanges.expiresAt, now),
      ),
    )
    .returning({
      userId: mobileAuthExchanges.userId,
      platform: mobileAuthExchanges.platform,
      label: mobileAuthExchanges.label,
    });

  if (!exchange) {
    throw new Error("Mobile auth code is invalid or expired.");
  }
  const [user] = await getDb()
    .select({
      githubId: users.githubId,
      login: users.login,
      publicLeaderboard: users.publicLeaderboard,
      publicActivityHistory: users.publicActivityHistory,
      publicHealthDataConsentVersion: users.publicHealthDataConsentVersion,
      publicHealthDataConsentedAt: users.publicHealthDataConsentedAt,
    })
    .from(users)
    .where(eq(users.id, exchange.userId))
    .limit(1);

  if (!user) {
    throw new Error("Mobile auth user does not exist.");
  }
  if (!exchange.platform || !exchange.label) {
    throw new Error("Mobile auth exchange is incomplete.");
  }

  const deviceExchange = createDeviceExchange({
    user,
    platform: exchange.platform,
    label: exchange.label,
  });
  await persistMobileDevice({
    deviceExchange,
    githubId: user.githubId,
  });
  const updatedUser = await applyMobileLeaderboardPreference({
    publicLeaderboard,
    publicHealthDataConsent,
    userId: exchange.userId,
  });
  await refreshMobileVisibilityScores(updatedUser);
  return withAuthoritativePublicConsent(deviceExchange, updatedUser);
}

export async function exchangeMobilePairingCode({
  code,
  label,
  platform,
  publicLeaderboard,
  publicHealthDataConsent,
}: DeviceExchangeRequest): Promise<DeviceExchangeResponse> {
  const normalizedPlatform = assertPlatform(platform);
  const normalizedLabel = normalizeDeviceLabel(label, normalizedPlatform);
  const now = new Date();
  const [exchange] = await getDb()
    .update(mobileAuthExchanges)
    .set({
      consumedAt: now,
      platform: normalizedPlatform,
      label: normalizedLabel,
    })
    .where(
      and(
        eq(mobileAuthExchanges.codeHash, hashMobileAuthCode(code)),
        isNull(mobileAuthExchanges.consumedAt),
        gt(mobileAuthExchanges.expiresAt, now),
      ),
    )
    .returning({
      userId: mobileAuthExchanges.userId,
    });

  if (!exchange) {
    throw new Error("Pairing code is invalid or expired.");
  }

  const [user] = await getDb()
    .select({
      githubId: users.githubId,
      login: users.login,
      publicLeaderboard: users.publicLeaderboard,
      publicActivityHistory: users.publicActivityHistory,
      publicHealthDataConsentVersion: users.publicHealthDataConsentVersion,
      publicHealthDataConsentedAt: users.publicHealthDataConsentedAt,
      publicHealthDataConsentRevokedAt: users.publicHealthDataConsentRevokedAt,
    })
    .from(users)
    .where(eq(users.id, exchange.userId))
    .limit(1);

  if (!user) {
    throw new Error("Pairing user does not exist.");
  }

  const nextPublicLeaderboard =
    typeof publicLeaderboard === "boolean"
      ? publicLeaderboard
      : normalizedPlatform === "ios"
        ? false
        : user.publicLeaderboard;
  const deviceExchange = createDeviceExchange({
    user,
    platform: normalizedPlatform,
    label: normalizedLabel,
  });
  await persistMobileDevice({
    deviceExchange,
    githubId: user.githubId,
  });
  const updatedUser = await applyMobileLeaderboardPreference({
    publicLeaderboard: nextPublicLeaderboard,
    publicHealthDataConsent,
    userId: exchange.userId,
  });
  await refreshMobileVisibilityScores(updatedUser);
  return withAuthoritativePublicConsent(deviceExchange, updatedUser);
}

function withAuthoritativePublicConsent(
  deviceExchange: DeviceExchangeResponse,
  user: Awaited<ReturnType<typeof updateAccountSettings>>,
): DeviceExchangeResponse {
  return {
    ...deviceExchange,
    publicLeaderboard: user.publicLeaderboard,
    publicActivityHistory: user.publicActivityHistory,
    publicHealthDataConsentVersion: user.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt:
      user.publicHealthDataConsentedAt?.toISOString() ?? null,
  };
}

async function applyMobileLeaderboardPreference({
  publicLeaderboard,
  publicHealthDataConsent,
  userId,
}: {
  publicLeaderboard: boolean;
  publicHealthDataConsent?: DeviceExchangeRequest["publicHealthDataConsent"];
  userId: string;
}) {
  const updatedUser = await updateAccountSettings({
    userId,
    publicLeaderboard,
    publicHealthDataConsent,
  });
  invalidatePublicDiscoveryCache();
  return updatedUser;
}

async function refreshMobileVisibilityScores(
  user: Awaited<ReturnType<typeof updateAccountSettings>>,
): Promise<void> {
  try {
    await refreshScoresAfterLeaderboardVisibilityChange({
      userId: user.id,
      login: user.login,
      publicLeaderboard: user.publicLeaderboard,
    });
  } catch (error) {
    console.error("[mobile-auth] score refresh after privacy choice failed", error);
  }
}

export async function getStoredDeviceByToken({
  deviceId,
  token,
}: {
  deviceId: string;
  token: string;
}): Promise<VerifiedMobileDevice | null> {
  const [row] = await getDb()
    .select({
      deviceId: mobileDevices.id,
      platform: mobileDevices.platform,
      label: mobileDevices.label,
      lastSeenAt: mobileDevices.lastSeenAt,
      revoked: mobileDevices.revoked,
      userId: users.id,
      githubId: users.githubId,
      login: users.login,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(mobileDevices)
    .innerJoin(users, eq(mobileDevices.userId, users.id))
    .where(
      and(
        eq(mobileDevices.id, deviceId),
        eq(mobileDevices.tokenHash, hashMobileToken(token)),
        eq(mobileDevices.revoked, false),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    user: {
      id: row.userId,
      githubId: row.githubId,
      login: row.login,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    },
    device: {
      id: row.deviceId,
      platform: row.platform,
      label: row.label,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      revoked: row.revoked,
    },
  };
}

export async function verifyDeviceToken(
  authorizationHeader: string | null,
): Promise<VerifiedMobileDevice | null> {
  const decoded = decodeDeviceToken(authorizationHeader);
  if (!decoded) return null;
  return getStoredDeviceByToken({
    deviceId: decoded.payload.deviceId,
    token: decoded.token,
  });
}

export async function listMobileDevices(userId: string): Promise<MobileDeviceSummary[]> {
  const rows = await getDb()
    .select({
      id: mobileDevices.id,
      platform: mobileDevices.platform,
      label: mobileDevices.label,
      lastSeenAt: mobileDevices.lastSeenAt,
      revoked: mobileDevices.revoked,
    })
    .from(mobileDevices)
    .where(eq(mobileDevices.userId, userId));

  return rows.map((device) => ({
    ...device,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  }));
}

export async function upsertDistanceDays({
  auth,
  days,
}: {
  auth: VerifiedMobileDevice;
  days: Array<DistanceDayInput & { flagged: boolean }>;
}): Promise<void> {
  if (days.length === 0) return;

  const now = new Date();

  await getDb()
    .insert(distanceDays)
    .values(
      days.map((day) => ({
        userId: auth.user.id,
        deviceId: auth.device.id,
        day: day.date,
        meters: Math.round(day.meters),
        sourcePlatform: day.sourcePlatform,
        sourceHash: day.sourceHash,
        flagged: day.flagged,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [distanceDays.userId, distanceDays.day],
      set: {
        meters: sql`excluded.meters`,
        deviceId: sql`excluded.device_id`,
        sourcePlatform: sql`excluded.source_platform`,
        sourceHash: sql`excluded.source_hash`,
        flagged: sql`excluded.flagged`,
        updatedAt: now,
      },
    });

  await touchDevice(auth.device.id);
}

export async function recordSyncRun({
  auth,
  run,
}: {
  auth: VerifiedMobileDevice;
  run: SyncRunRequest;
}): Promise<SyncRunResponse> {
  const [savedRun] = await getDb()
    .insert(syncRuns)
    .values({
      userId: auth.user.id,
      deviceId: auth.device.id,
      platform: run.platform,
      status: run.status,
      startedAt: new Date(run.startedAt),
      finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
      counters: run.counters,
      errorSummary: run.errorSummary,
    })
    .returning({
      id: syncRuns.id,
      status: syncRuns.status,
    });

  await touchDevice(auth.device.id);

  return savedRun;
}

export async function revokeMobileDevice({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<MobileDeviceSummary | null> {
  const [device] = await getDb()
    .update(mobileDevices)
    .set({ revoked: true })
    .where(and(eq(mobileDevices.id, id), eq(mobileDevices.userId, userId)))
    .returning({
      id: mobileDevices.id,
      platform: mobileDevices.platform,
      label: mobileDevices.label,
      lastSeenAt: mobileDevices.lastSeenAt,
      revoked: mobileDevices.revoked,
    });

  if (!device) return null;

  return {
    ...device,
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  };
}

async function touchDevice(deviceId: string): Promise<void> {
  await getDb()
    .update(mobileDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(mobileDevices.id, deviceId));
}

function hashMobileAuthCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
