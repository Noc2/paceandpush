import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  DeviceExchangeResponse,
  MobileDeviceSummary,
  Platform,
} from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";

const deviceTokenPrefix = "pp_dev";
const mobileAuthStatePrefix = "pp_mob_state";
const mobileAuthStateTtlMs = 10 * 60 * 1000;
const deviceTtlMs = 365 * 24 * 60 * 60 * 1000;

interface MobileAuthStatePayload {
  kind: "mobile-auth-state";
  platform: Platform;
  label: string;
  callbackScheme: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  exp: number;
}

export interface DeviceTokenPayload {
  kind: "device";
  sub: string;
  login: string;
  deviceId: string;
  platform: Platform;
  label: string;
  exp: number;
}

export interface DecodedDeviceToken {
  payload: DeviceTokenPayload;
  token: string;
}

export function createMobileAuthState({
  platform,
  label,
  callbackScheme,
  codeChallenge,
  ttlMs = mobileAuthStateTtlMs,
}: {
  platform: unknown;
  label: string;
  callbackScheme: string;
  codeChallenge: string;
  ttlMs?: number;
}): string {
  const normalizedPlatform = assertPlatform(platform);
  return signToken(mobileAuthStatePrefix, {
    kind: "mobile-auth-state",
    platform: normalizedPlatform,
    label: normalizeDeviceLabel(label, normalizedPlatform),
    callbackScheme: normalizeCallbackScheme(callbackScheme, normalizedPlatform),
    codeChallenge: normalizePKCECodeChallenge(codeChallenge),
    codeChallengeMethod: "S256",
    exp: Date.now() + ttlMs,
  } satisfies MobileAuthStatePayload);
}

export function verifyMobileAuthState(state: string): MobileAuthStatePayload {
  const payload = verifySignedToken<MobileAuthStatePayload>(mobileAuthStatePrefix, state);
  if (!payload || payload.kind !== "mobile-auth-state" || payload.exp < Date.now()) {
    throw new Error("Mobile auth state is invalid or expired.");
  }
  return {
    ...payload,
    platform: assertPlatform(payload.platform),
    label: normalizeDeviceLabel(payload.label, payload.platform),
    callbackScheme: normalizeCallbackScheme(payload.callbackScheme, payload.platform),
    codeChallenge: normalizePKCECodeChallenge(payload.codeChallenge),
    codeChallengeMethod: "S256",
  };
}

export function createDeviceExchange({
  user,
  platform,
  label,
}: {
  user: Pick<SessionUser, "githubId" | "login"> & {
    publicLeaderboard: boolean;
    publicActivityHistory: boolean;
    publicHealthDataConsentVersion: string | null;
    publicHealthDataConsentedAt: Date | null;
  };
  platform: Platform;
  label: string;
}): DeviceExchangeResponse {
  const deviceId = randomUUID();
  const expiresAt = Date.now() + deviceTtlMs;
  const device: MobileDeviceSummary = {
    id: deviceId,
    platform,
    label,
    lastSeenAt: new Date().toISOString(),
    revoked: false,
  };

  return {
    device,
    publicLeaderboard: user.publicLeaderboard,
    publicActivityHistory: user.publicActivityHistory,
    publicHealthDataConsentVersion: user.publicHealthDataConsentVersion,
    publicHealthDataConsentedAt: user.publicHealthDataConsentedAt?.toISOString() ?? null,
    token: signToken(deviceTokenPrefix, {
      kind: "device",
      sub: user.githubId,
      login: user.login,
      deviceId,
      platform,
      label,
      exp: expiresAt,
    }),
  };
}

export function decodeDeviceToken(
  authorizationHeader: string | null,
): DecodedDeviceToken | null {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const payload = verifySignedToken<DeviceTokenPayload>(deviceTokenPrefix, token);
  if (!payload || payload.kind !== "device" || payload.exp < Date.now()) {
    return null;
  }

  return { payload, token };
}

export function hashMobileToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function codeChallengeForVerifier(codeVerifier: string): string {
  if (!isPKCECodeVerifier(codeVerifier)) {
    throw new Error("Code verifier is invalid.");
  }
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

export function isPKCECodeVerifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 43 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._~-]+$/.test(value)
  );
}

function signToken(prefix: string, payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = sign(encodedPayload);
  return `${prefix}.${encodedPayload}.${signature}`;
}

function verifySignedToken<T>(prefix: string, token: string): T | null {
  const [actualPrefix, payload, signature] = token.split(".");
  if (actualPrefix !== prefix || !payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", getMobileTokenSecret())
    .update(payload)
    .digest("base64url");
}

function getMobileTokenSecret(): string {
  const secret = process.env.MOBILE_TOKEN_SECRET;

  if (secret) {
    if (process.env.NODE_ENV === "production" && secret === process.env.SESSION_SECRET) {
      throw new Error("MOBILE_TOKEN_SECRET must be distinct from SESSION_SECRET in production.");
    }
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("MOBILE_TOKEN_SECRET is required in production.");
  }

  return process.env.SESSION_SECRET || "paceandpush-local-dev-mobile-secret";
}

export function assertPlatform(platform: unknown): Platform {
  if (platform === "ios" || platform === "android") return platform;
  throw new Error("Device platform must be ios or android.");
}

export function normalizeDeviceLabel(label: string, platform: Platform): string {
  const trimmed = label.trim();
  if (trimmed.length > 0) return trimmed.slice(0, 64);
  return platform === "ios" ? "iPhone" : "Android";
}

function normalizeCallbackScheme(callbackScheme: string, platform: Platform): string {
  const trimmed = callbackScheme.trim().toLowerCase();
  if (!/^[a-z][a-z0-9+.-]{1,63}$/.test(trimmed)) {
    throw new Error("Callback scheme is invalid.");
  }

  const allowedByPlatform: Record<Platform, string[]> = {
    ios: ["pacepush"],
    android: ["pacepush"],
  };

  if (!allowedByPlatform[platform].includes(trimmed)) {
    throw new Error("Callback scheme is not allowed for this platform.");
  }

  return trimmed;
}

function normalizePKCECodeChallenge(codeChallenge: string): string {
  const trimmed = codeChallenge.trim();
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(trimmed)) {
    throw new Error("Code challenge is invalid.");
  }
  return trimmed;
}
