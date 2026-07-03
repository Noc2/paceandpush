import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export interface SessionUser {
  githubId: string;
  login: string;
  displayName: string;
  avatarUrl: string | null;
}

const sessionCookieName = "pace_push_session";

export function getSessionCookieName(): string {
  return sessionCookieName;
}

export function signSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
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
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
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
  return process.env.SESSION_SECRET || "paceandpush-local-dev-session-secret";
}

