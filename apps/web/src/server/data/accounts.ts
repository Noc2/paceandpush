import { createHash } from "node:crypto";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { githubAccounts, users } from "@/server/db/schema";
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
