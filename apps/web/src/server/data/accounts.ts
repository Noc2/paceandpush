import { createHash } from "node:crypto";
import type { PublicHealthDataConsentRequest } from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  commitDays,
  distanceDays,
  githubAccounts,
  mobileAuthExchanges,
  mobileDevices,
  scoreSnapshots,
  syncRuns,
  users,
} from "@/server/db/schema";
import {
  decryptGitHubAccessToken,
  encryptGitHubAccessToken,
  githubTokenEncryptionKeyId,
} from "@/server/github/token-crypto";
import { eq } from "drizzle-orm";
import { currentPublicHealthDataConsentVersion } from "@/server/privacy/public-health-data-consent";

export interface GitHubConnectionSummary {
  connected: boolean;
  needsReconnect: boolean;
  updatedAt: string | null;
}

export interface AccountUser extends SessionUser {
  id: string;
  bio: string | null;
  publicLeaderboard: boolean;
  publicActivityHistory: boolean;
  publicHealthDataConsentVersion: string | null;
  publicHealthDataConsentedAt: Date | null;
  publicHealthDataConsentRevokedAt: Date | null;
  units: "metric" | "imperial";
}

export async function upsertGitHubAccount({
  user,
  accessToken,
  scopes,
  publicLeaderboard,
}: {
  user: SessionUser;
  accessToken: string;
  scopes: string[];
  publicLeaderboard?: boolean;
}): Promise<AccountUser> {
  if (publicLeaderboard === true) {
    throw new Error("Public health data requires versioned consent.");
  }
  const db = getDb();
  const now = new Date();
  const encryptedAccessToken = encryptGitHubAccessToken(accessToken);
  const encryptionKeyId = githubTokenEncryptionKeyId();

  const [savedUser] = await db
    .insert(users)
    .values({
      githubId: user.githubId,
      login: user.login,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      publicLeaderboard: publicLeaderboard ?? false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        ...(typeof publicLeaderboard === "boolean" ? { publicLeaderboard } : {}),
        ...(publicLeaderboard === false
          ? {
              publicActivityHistory: false,
              publicHealthDataConsentRevokedAt: now,
            }
          : {}),
        updatedAt: now,
      },
    })
    .returning();

  await db
    .insert(githubAccounts)
    .values({
      userId: savedUser.id,
      githubId: savedUser.githubId,
      login: savedUser.login,
      accessTokenHash: hashSecret(accessToken),
      accessTokenEncrypted: encryptedAccessToken,
      accessTokenEncryptionKeyId: encryptionKeyId,
      accessTokenEncryptedAt: now,
      scopes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: githubAccounts.userId,
      set: {
        githubId: savedUser.githubId,
        login: savedUser.login,
        accessTokenHash: hashSecret(accessToken),
        accessTokenEncrypted: encryptedAccessToken,
        accessTokenEncryptionKeyId: encryptionKeyId,
        accessTokenEncryptedAt: now,
        scopes,
        updatedAt: now,
      },
    });

  return toAccountUser(savedUser);
}

export async function getGitHubAccessToken(userId: string): Promise<string | null> {
  const [account] = await getDb()
    .select({
      accessTokenEncrypted: githubAccounts.accessTokenEncrypted,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1);

  if (!account?.accessTokenEncrypted) return null;
  return decryptGitHubAccessToken(account.accessTokenEncrypted);
}

export async function getGitHubConnectionSummary(
  userId: string,
): Promise<GitHubConnectionSummary> {
  const [account] = await getDb()
    .select({
      accessTokenEncrypted: githubAccounts.accessTokenEncrypted,
      accessTokenHash: githubAccounts.accessTokenHash,
      accessTokenEncryptedAt: githubAccounts.accessTokenEncryptedAt,
      updatedAt: githubAccounts.updatedAt,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1);

  const connected = Boolean(account?.accessTokenEncrypted);

  return {
    connected,
    needsReconnect: Boolean(account && !connected && account.accessTokenHash),
    updatedAt:
      account?.accessTokenEncryptedAt?.toISOString() ??
      account?.updatedAt?.toISOString() ??
      null,
  };
}

export async function listGitHubAccountsForScoreRefresh(): Promise<
  Array<{ userId: string; login: string; accessToken: string | null }>
> {
  const rows = await getDb()
    .select({
      userId: githubAccounts.userId,
      login: githubAccounts.login,
      accessTokenEncrypted: githubAccounts.accessTokenEncrypted,
    })
    .from(githubAccounts);

  return rows.map((row) => ({
    userId: row.userId,
    login: row.login,
    accessToken: row.accessTokenEncrypted
      ? decryptGitHubAccessToken(row.accessTokenEncrypted)
      : null,
  }));
}

export async function getAccountUser(
  sessionUser: SessionUser | null,
): Promise<AccountUser | null> {
  if (!sessionUser) return null;

  const [row] = await getDb()
    .select()
    .from(users)
    .where(eq(users.githubId, sessionUser.githubId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    githubId: row.githubId,
    login: row.login,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    publicLeaderboard: row.publicLeaderboard,
    publicActivityHistory: row.publicActivityHistory,
    publicHealthDataConsentVersion: row.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt: row.publicHealthDataConsentedAt,
    publicHealthDataConsentRevokedAt: row.publicHealthDataConsentRevokedAt,
    units: row.units === "imperial" ? "imperial" : "metric",
  };
}

export async function updateAccountSettings({
  userId,
  publicLeaderboard,
  publicHealthDataConsent,
  units,
}: {
  userId: string;
  publicLeaderboard?: boolean;
  publicHealthDataConsent?: PublicHealthDataConsentRequest;
  units?: "metric" | "imperial";
}): Promise<AccountUser> {
  const now = new Date();
  const [currentUser] = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!currentUser) {
    throw new Error("Account does not exist.");
  }
  if (publicHealthDataConsent && publicLeaderboard !== true) {
    throw new Error("Public health data consent requires public visibility.");
  }

  const hasCurrentConsent =
    currentUser.publicLeaderboard &&
    currentUser.publicHealthDataConsentVersion === currentPublicHealthDataConsentVersion &&
    currentUser.publicHealthDataConsentedAt !== null &&
    currentUser.publicHealthDataConsentRevokedAt === null;
  const publicationUpdate =
    publicLeaderboard === true && publicHealthDataConsent
      ? {
          publicLeaderboard: true,
          publicActivityHistory: publicHealthDataConsent.publicActivityHistory,
          publicHealthDataConsentVersion: publicHealthDataConsent.version,
          publicHealthDataConsentedAt: now,
          publicHealthDataConsentRevokedAt: null,
        }
      : publicLeaderboard === true && !hasCurrentConsent
        ? {
            publicLeaderboard: false,
            publicActivityHistory: false,
          }
        : publicLeaderboard === false
          ? {
              publicLeaderboard: false,
              publicActivityHistory: false,
              publicHealthDataConsentRevokedAt: now,
            }
          : {};

  const [updatedUser] = await getDb()
    .update(users)
    .set({
      ...publicationUpdate,
      ...(units ? { units } : {}),
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning();

  return {
    id: updatedUser.id,
    githubId: updatedUser.githubId,
    login: updatedUser.login,
    displayName: updatedUser.displayName,
    avatarUrl: updatedUser.avatarUrl,
    bio: updatedUser.bio,
    publicLeaderboard: updatedUser.publicLeaderboard,
    publicActivityHistory: updatedUser.publicActivityHistory,
    publicHealthDataConsentVersion: updatedUser.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt: updatedUser.publicHealthDataConsentedAt,
    publicHealthDataConsentRevokedAt: updatedUser.publicHealthDataConsentRevokedAt,
    units: updatedUser.units === "imperial" ? "imperial" : "metric",
  };
}

export async function disconnectGitHubAccount(userId: string): Promise<void> {
  const db = getDb();
  await db
    .update(githubAccounts)
    .set({
      accessTokenHash: null,
      accessTokenEncrypted: null,
      accessTokenEncryptionKeyId: null,
      accessTokenEncryptedAt: null,
      scopes: [],
      updatedAt: new Date(),
    })
    .where(eq(githubAccounts.userId, userId));
  await db.delete(commitDays).where(eq(commitDays.userId, userId));
  await db.delete(scoreSnapshots).where(eq(scoreSnapshots.userId, userId));
}

export async function exportAccountData(userId: string) {
  const db = getDb();
  const [account] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [githubAccount] = await db
    .select({
      githubId: githubAccounts.githubId,
      login: githubAccounts.login,
      scopes: githubAccounts.scopes,
      createdAt: githubAccounts.createdAt,
      updatedAt: githubAccounts.updatedAt,
    })
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, userId))
    .limit(1);

  const [devices, commits, distances, scores, runs] = await Promise.all([
    db
      .select({
        id: mobileDevices.id,
        platform: mobileDevices.platform,
        label: mobileDevices.label,
        revoked: mobileDevices.revoked,
        lastSeenAt: mobileDevices.lastSeenAt,
        createdAt: mobileDevices.createdAt,
      })
      .from(mobileDevices)
      .where(eq(mobileDevices.userId, userId)),
    db
      .select({
        day: commitDays.day,
        commitCount: commitDays.commitCount,
        createdAt: commitDays.createdAt,
        updatedAt: commitDays.updatedAt,
      })
      .from(commitDays)
      .where(eq(commitDays.userId, userId)),
    db
      .select({
        day: distanceDays.day,
        meters: distanceDays.meters,
        sourcePlatform: distanceDays.sourcePlatform,
        flagged: distanceDays.flagged,
        createdAt: distanceDays.createdAt,
        updatedAt: distanceDays.updatedAt,
      })
      .from(distanceDays)
      .where(eq(distanceDays.userId, userId)),
    db.select().from(scoreSnapshots).where(eq(scoreSnapshots.userId, userId)),
    db.select().from(syncRuns).where(eq(syncRuns.userId, userId)),
  ]);

  return {
    account,
    githubAccount,
    devices,
    commitDays: commits,
    distanceDays: distances,
    scoreSnapshots: scores,
    syncRuns: runs,
  };
}

export async function deleteAccountData(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(syncRuns).where(eq(syncRuns.userId, userId));
  await db.delete(distanceDays).where(eq(distanceDays.userId, userId));
  await db.delete(commitDays).where(eq(commitDays.userId, userId));
  await db.delete(scoreSnapshots).where(eq(scoreSnapshots.userId, userId));
  await db.delete(mobileDevices).where(eq(mobileDevices.userId, userId));
  await db.delete(mobileAuthExchanges).where(eq(mobileAuthExchanges.userId, userId));
  await db.delete(githubAccounts).where(eq(githubAccounts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function toSessionUser(user: typeof users.$inferSelect): SessionUser {
  return {
    githubId: user.githubId,
    login: user.login,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

function toAccountUser(user: typeof users.$inferSelect): AccountUser {
  return {
    id: user.id,
    ...toSessionUser(user),
    bio: user.bio,
    publicLeaderboard: user.publicLeaderboard,
    publicActivityHistory: user.publicActivityHistory,
    publicHealthDataConsentVersion: user.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt: user.publicHealthDataConsentedAt,
    publicHealthDataConsentRevokedAt: user.publicHealthDataConsentRevokedAt,
    units: user.units === "imperial" ? "imperial" : "metric",
  };
}
