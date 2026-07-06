import { parsePeriod, searchPublicUsers } from "@/server/data/read-model";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const period = parsePeriod(request.nextUrl.searchParams.get("period"));
  const limit = parseSearchLimit(request.nextUrl.searchParams.get("limit"));

  return NextResponse.json(await searchPublicUsers({ limit, period, query }));
}

function parseSearchLimit(value: string | null): number | undefined {
  if (!value) return undefined;

  const limit = Number(value);
  return Number.isInteger(limit) ? limit : undefined;
}
