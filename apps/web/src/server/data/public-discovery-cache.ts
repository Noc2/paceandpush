import type { Board } from "@paceandpush/api-contracts";
import { revalidateTag, unstable_cache } from "next/cache";
import { getLeaderboard, searchPublicUsers } from "@/server/data/read-model";

const publicDiscoveryCacheTag = "public-discovery";
const publicDiscoveryRevalidateSeconds = 300;

export const getCachedLeaderboard = unstable_cache(
  async (board: Board, period: string) => getLeaderboard(board, period),
  ["public-leaderboard-private-default-v2"],
  {
    revalidate: publicDiscoveryRevalidateSeconds,
    tags: [publicDiscoveryCacheTag],
  },
);

export const searchCachedPublicUsers = unstable_cache(
  async ({ limit, period, query }: { limit?: number; period: string; query: string }) =>
    searchPublicUsers({ limit, period, query }),
  ["public-user-search-private-default-v2"],
  {
    revalidate: publicDiscoveryRevalidateSeconds,
    tags: [publicDiscoveryCacheTag],
  },
);

export function invalidatePublicDiscoveryCache(): void {
  revalidateTag(publicDiscoveryCacheTag, { expire: 0 });
}
