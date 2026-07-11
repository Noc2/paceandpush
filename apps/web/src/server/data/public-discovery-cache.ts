import type { Board } from "@paceandpush/api-contracts";
import { getLeaderboard, searchPublicUsers } from "@/server/data/read-model";

export async function getCachedLeaderboard(board: Board, period: string) {
  return getLeaderboard(board, period);
}

export async function searchCachedPublicUsers({
  limit,
  period,
  query,
}: {
  limit?: number;
  period: string;
  query: string;
}) {
  return searchPublicUsers({ limit, period, query });
}

export function invalidatePublicDiscoveryCache(): void {}
