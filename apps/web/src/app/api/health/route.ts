import { getDb, isDatabaseConfigured } from "@/server/db/client";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  if (!isDatabaseConfigured()) {
    return healthResponse(
      {
        ok: false,
        checkedAt,
        database: "not_configured",
      },
      503,
    );
  }

  try {
    await getDb().execute(sql`select 1`);
    return healthResponse({
      ok: true,
      checkedAt,
      database: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[health] database check failed", error);
    return healthResponse(
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

function healthResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}
