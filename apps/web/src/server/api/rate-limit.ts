import { NextRequest, NextResponse } from "next/server";

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
  keyParts?: Array<string | number | null | undefined>;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

export function rateLimit(
  request: NextRequest,
  { bucket, limit, windowMs, keyParts = [] }: RateLimitOptions,
): NextResponse | null {
  const now = Date.now();
  pruneExpired(now);

  const key = [
    bucket,
    clientKey(request),
    ...keyParts.map((part) => String(part ?? "unknown")),
  ].join(":");
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count += 1;
  if (entry.count <= limit) return null;

  return tooManyRequests(Math.ceil((entry.resetAt - now) / 1000));
}

export function minimumInterval(
  key: string,
  intervalMs: number,
): NextResponse | null {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + intervalMs });
    return null;
  }

  return tooManyRequests(Math.ceil((existing.resetAt - now) / 1000));
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Please retry later." },
    {
      status: 429,
      headers: {
        "cache-control": "no-store",
        "retry-after": String(Math.max(retryAfterSeconds, 1)),
      },
    },
  );
}

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function pruneExpired(now: number): void {
  if (buckets.size < 1000) return;

  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}
