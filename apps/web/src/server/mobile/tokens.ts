import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  DeviceExchangeRequest,
  DeviceExchangeResponse,
  MobileDeviceSummary,
  PairingCodeResponse,
  Platform,
} from "@paceandpush/api-contracts";
import type { SessionUser } from "@/server/auth/session";

const pairingTokenPrefix = "pp_pair";
const deviceTokenPrefix = "pp_dev";
const pairingTtlMs = 10 * 60 * 1000;
const deviceTtlMs = 365 * 24 * 60 * 60 * 1000;

interface PairingTokenPayload {
  kind: "pairing";
  sub: string;
  login: string;
  displayName: string;
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

export function createPairingCode(
  user: SessionUser,
  ttlMs = pairingTtlMs,
): PairingCodeResponse {
  const expiresAt = Date.now() + ttlMs;
  return {
    code: signToken(pairingTokenPrefix, {
      kind: "pairing",
      sub: user.githubId,
      login: user.login,
      displayName: user.displayName,
      exp: expiresAt,
    }),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function exchangePairingCode(
  request: DeviceExchangeRequest,
): DeviceExchangeResponse {
  const pairing = verifyPairingToken(request.code);
  const platform = assertPlatform(request.platform);
  const label = normalizeDeviceLabel(request.label, platform);
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
    token: signToken(deviceTokenPrefix, {
      kind: "device",
      sub: pairing.sub,
      login: pairing.login,
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

function verifyPairingToken(code: string): PairingTokenPayload {
  const payload = verifySignedToken<PairingTokenPayload>(pairingTokenPrefix, code);
  if (!payload || payload.kind !== "pairing" || payload.exp < Date.now()) {
    throw new Error("Pairing code is invalid or expired.");
  }
  return payload;
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
  return (
    process.env.MOBILE_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    "paceandpush-local-dev-mobile-secret"
  );
}

function assertPlatform(platform: unknown): Platform {
  if (platform === "ios" || platform === "android") return platform;
  throw new Error("Device platform must be ios or android.");
}

function normalizeDeviceLabel(label: string, platform: Platform): string {
  const trimmed = label.trim();
  if (trimmed.length > 0) return trimmed.slice(0, 64);
  return platform === "ios" ? "iPhone" : "Android";
}
