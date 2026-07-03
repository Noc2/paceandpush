import type {
  DeviceExchangeResponse,
  DistanceDayInput,
  MobileDeviceSummary,
  SyncRunRequest,
  SyncRunResponse,
} from "@paceandpush/api-contracts";
import { getDb } from "@/server/db/client";
import { distanceDays, mobileDevices, syncRuns, users } from "@/server/db/schema";
import { decodeDeviceToken, hashMobileToken } from "@/server/mobile/tokens";
import { and, eq, sql } from "drizzle-orm";

export interface VerifiedMobileDevice {
  user: {
    id: string;
    githubId: string;
    login: string;
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
