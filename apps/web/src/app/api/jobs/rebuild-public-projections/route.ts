import { timingSafeEqual } from "node:crypto";
import { publishPublicPeriods } from "@/server/data/public-discovery-cache";
import { getPublicProjectionPeriods } from "@/server/data/read-model";
import { drainDirtyScorePeriods } from "@/server/data/scores";
import { parsePublicPeriod } from "@/lib/periods";
import { measureOperation } from "@/server/observability/operations";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return response({ error: "Unauthorized" }, 401);
  }

  const requestedPeriod = request.nextUrl.searchParams.get("period");
  const period = requestedPeriod === null ? null : parsePublicPeriod(requestedPeriod);
  if (requestedPeriod !== null && !period) {
    return response({ error: "Unsupported period." }, 400);
  }

  try {
    const refreshedPeriods = new Set<string>();
    let refreshedScores = 0;
    if (!period) {
      for (let batch = 0; batch < 20; batch += 1) {
        const drained = await drainDirtyScorePeriods({ limit: 500 });
        if (drained.failed.length > 0) {
          throw new Error("One or more dirty score periods could not be refreshed.");
        }
        refreshedScores += drained.processed;
        for (const refresh of drained.refreshed) {
          for (const refreshedPeriod of refresh.periods) {
            refreshedPeriods.add(refreshedPeriod);
          }
        }
        if (drained.processed < 500) break;
        if (batch === 19) {
          throw new Error("The dirty score backlog exceeds the protected rebuild limit.");
        }
      }
    }
    const periods = period
      ? [period]
      : [...new Set([
          ...await getPublicProjectionPeriods(),
          ...refreshedPeriods,
        ])].sort();
    await measureOperation(
      "public_projection.rebuild",
      () => publishPublicPeriods(periods),
      () => ({ itemCount: periods.length }),
    );
    return response({
      ok: true,
      periods,
      refreshedScores,
      rebuiltAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[public-projection] protected rebuild failed", error);
    return response(
      {
        ok: false,
        error: "Public projection rebuild failed.",
        rebuiltAt: new Date().toISOString(),
      },
      503,
    );
  }
}

function isAuthorized(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  const bearerPrefix = "Bearer ";
  if (!secret || !authorization?.startsWith(bearerPrefix)) return false;

  const actual = Buffer.from(authorization.slice(bearerPrefix.length));
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
