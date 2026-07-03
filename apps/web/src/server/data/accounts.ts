import { createHash } from "node:crypto";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  commitDays,
  distanceDays,
  githubAccounts,
  mobileDevices,
  scoreSnapshots,
  syncRuns,
  users,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";

export interface AccountUser extends SessionUser {
  id: string;
  bio: string | null;
  publicLeaderboard: boolean;
  units: "metric" | "imperial";
}

export async function upsertGitHubAccount({
  user,
  accessToken,
  scopes,
}: {
  user: SessionUser;
  accessToken: string;
  scopes: string[];
}): Promise<SessionUser> {
  const db = getDb();
  const now = new Date();

  const [savedUser] = await db
    .insert(users)
    .values({
      githubId: user.githubId,
      login: user.login,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.githubId,
      set: {
        login: user.login,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
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
      scopes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: githubAccounts.userId,
      set: {
        githubId: savedUser.githubId,
        login: savedUser.login,
        accessTokenHash: hashSecret(accessToken),
        scopes,
        updatedAt: now,
      },
    });

  return toSessionUser(savedUser);
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
    units: row.units === "imperial" ? "imperial" : "metric",
  };
}

export async function updateAccountSettings({
  userId,
  publicLeaderboard,
  units,
}: {
  userId: string;
  publicLeaderboard?: boolean;
  units?: "metric" | "imperial";
}): Promise<AccountUser> {
  const [updatedUser] = await getDb()
    .update(users)
    .set({
      ...(typeof publicLeaderboard === "boolean" ? { publicLeaderboard } : {}),
      ...(units ? { units } : {}),
      updatedAt: new Date(),
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
    units: updatedUser.units === "imperial" ? "imperial" : "metric",
  };
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
    db.select().from(mobileDevices).where(eq(mobileDevices.userId, userId)),
    db.select().from(commitDays).where(eq(commitDays.userId, userId)),
    db.select().from(distanceDays).where(eq(distanceDays.userId, userId)),
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
