import { timingSafeEqual } from "node:crypto";
import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { measureOperation } from "@/server/observability/operations";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const requiredMigration = "0015_incremental_period_scores.sql";

export async function GET(request: NextRequest) {
  if (!isAuthorizedReadinessRequest(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  )) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  if (!isDatabaseConfigured()) {
    return readinessResponse(
      {
        ok: false,
        checkedAt,
        database: "not_configured",
      },
      503,
    );
  }

  try {
    const migration = await measureOperation("readiness.database", async () => {
      const result = await getDb().execute(sql<{ current: boolean }>`
        select exists (
          select 1
          from paceandpush_schema_migrations
          where name = ${requiredMigration}
        ) as current
      `);
      return result.rows[0];
    });
    if (!migration?.current) {
      return readinessResponse(
        {
          ok: false,
          checkedAt,
          database: "ok",
          schema: "outdated",
          requiredMigration,
          latencyMs: Date.now() - startedAt,
        },
        503,
      );
    }

    return readinessResponse({
      ok: true,
      checkedAt,
      database: "ok",
      schema: "current",
      latencyMs: Date.now() - startedAt,
    });
  } catch {
    return readinessResponse(
      {
        ok: false,
        checkedAt,
        database: "error",
        latencyMs: Date.now() - startedAt,
      },
      503,
    );
  }
}

function isAuthorizedReadinessRequest(
  authorization: string | null,
  readinessSecret: string | undefined,
): boolean {
  const bearerPrefix = "Bearer ";
  if (!readinessSecret || !authorization?.startsWith(bearerPrefix)) return false;

  const actual = Buffer.from(authorization.slice(bearerPrefix.length));
  const expected = Buffer.from(readinessSecret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function readinessResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
