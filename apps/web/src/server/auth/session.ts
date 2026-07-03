import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export interface SessionUser {
  githubId: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
}

interface SignedSessionPayload extends SessionUser {
  exp: number;
}

const sessionCookieName = "pace_push_session";
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;

export function getSessionCookieName(): string {
  return sessionCookieName;
}

export function signSession(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Date.now() + sessionTtlMs,
    } satisfies SignedSessionPayload),
    "utf8",
  ).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<SignedSessionPayload>;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    if (!parsed.githubId || !parsed.login || !parsed.displayName) return null;

    return {
      githubId: parsed.githubId,
      login: parsed.login,
      displayName: parsed.displayName,
      avatarUrl: parsed.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(sessionCookieName)?.value);
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return "paceandpush-local-dev-session-secret";
}
