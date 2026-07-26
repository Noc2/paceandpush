import type {
  Board,
  LeaderboardResponse,
  LeaderboardRow,
  PublicProfileResponse,
  UserSearchResponse,
} from "@paceandpush/api-contracts";
import { buildPublicPeriodProjectionSource } from "@/server/data/read-model";
import {
  getPublicProjectionStore,
  type PublicPeriodProjection,
} from "@/server/data/public-projection-store";

export async function getCachedLeaderboard(
  board: Board,
  period: string,
): Promise<LeaderboardResponse> {
  const store = getPublicProjectionStore();
  const projection = await store.getPeriod(period);
  const projectedRows = projection?.boards[board] ?? [];
  const hiddenLogins = await store.getHiddenLogins(
    projectedRows.map((row) => row.login),
  );

  return {
    board,
    period,
    rows: rerank(
      projectedRows.filter(
        (row) => !hiddenLogins.has(normalizeLogin(row.login)),
      ),
    ).slice(0, 100),
  };
}

export async function searchCachedPublicUsers({
  limit = 20,
  period,
  query,
}: {
  limit?: number;
  period: string;
  query: string;
}): Promise<UserSearchResponse> {
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery.length < 2) {
    return { query: normalizedQuery, period, rows: [] };
  }

  const store = getPublicProjectionStore();
  const projection = await store.getPeriod(period);
  const projectedSearchRows = projection?.searchRows ?? [];
  const hiddenLogins = await store.getHiddenLogins(
    projectedSearchRows.map(({ row }) => row.login),
  );
  const visibleBalancedRows = rerank(
    (projection?.boards.balanced ?? []).filter(
      (row) => !hiddenLogins.has(normalizeLogin(row.login)),
    ),
  );
  const rankByLogin = new Map(
    visibleBalancedRows.map((row) => [normalizeLogin(row.login), row.rank]),
  );
  const rows = projectedSearchRows
    .filter(
      ({ row, searchText }) =>
        !hiddenLogins.has(normalizeLogin(row.login)) &&
        searchText.includes(normalizedQuery.toLowerCase()),
    )
    .map(({ row }) => ({
      ...row,
      rank: rankByLogin.get(normalizeLogin(row.login)) ?? row.rank,
    }))
    .sort(searchRowComparator(normalizedQuery))
    .slice(0, normalizeSearchLimit(limit));

  return {
    query: normalizedQuery,
    period,
    rows,
  };
}

export async function getCachedPublicProfile(
  login: string,
  period: string,
): Promise<PublicProfileResponse | null> {
  const store = getPublicProjectionStore();
  const [profile, projection] = await Promise.all([
    store.getProfile(login, period),
    store.getPeriod(period),
  ]);
  const normalizedLogin = normalizeLogin(login);
  const balancedRows = projection?.boards.balanced ?? [];
  const hiddenLogins = await store.getHiddenLogins([
    login,
    ...balancedRows.map((row) => row.login),
  ]);

  if (!profile || hiddenLogins.has(normalizedLogin)) return null;

  const visibleRows = rerank(
    balancedRows.filter(
      (row) => !hiddenLogins.has(normalizeLogin(row.login)),
    ),
  );
  const row = visibleRows.find(
    (candidate) => normalizeLogin(candidate.login) === normalizedLogin,
  );
  if (!row) return null;

  return {
    ...profile,
    score: {
      ...profile.score,
      rank: row?.rank ?? null,
    },
  };
}

export async function hidePublicLogin(login: string): Promise<string> {
  return getPublicProjectionStore().hideLogin(login);
}

export async function publishPublicPeriods(
  periods: Iterable<string>,
): Promise<void> {
  for (const period of uniquePeriods(periods)) {
    await publishPublicPeriod(period);
  }
}

export async function publishPublicPeriod(period: string): Promise<void> {
  const source = await buildPublicPeriodProjectionSource(period);
  const projection: PublicPeriodProjection = {
    version: 1,
    generatedAt: new Date().toISOString(),
    period,
    boards: source.boards,
    searchRows: source.searchRows,
  };
  const store = getPublicProjectionStore();

  await store.replacePeriod(projection, source.profiles);
}

export async function publishAndShowPublicLogin(
  login: string,
  periods: Iterable<string>,
  visibilityToken: string,
): Promise<void> {
  const normalizedPeriods = uniquePeriods(periods);
  await publishPublicPeriods(normalizedPeriods);
  const store = getPublicProjectionStore();
  const profiles = await Promise.all(
    normalizedPeriods.map((period) => store.getProfile(login, period)),
  );

  if (profiles.every((profile) => profile === null)) {
    throw new Error("The public profile projection could not be published.");
  }

  if (!(await store.showLogin(login, visibilityToken))) {
    throw new Error(
      "The public profile visibility changed while its projection was being published.",
    );
  }
}

export async function removeProjectedProfiles(
  login: string,
  periods: Iterable<string>,
): Promise<void> {
  await getPublicProjectionStore().deleteProfiles(login, uniquePeriods(periods));
}

function rerank(rows: LeaderboardRow[]): LeaderboardRow[] {
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

function searchRowComparator(query: string) {
  const lowerQuery = query.toLowerCase();
  return (left: LeaderboardRow, right: LeaderboardRow): number => {
    const leftLogin = left.login.toLowerCase();
    const rightLogin = right.login.toLowerCase();
    const leftName = left.displayName.toLowerCase();
    const rightName = right.displayName.toLowerCase();
    const bucket = (login: string, name: string) =>
      login === lowerQuery
        ? 0
        : login.startsWith(lowerQuery)
          ? 1
          : name.startsWith(lowerQuery)
            ? 2
            : 3;

    return (
      bucket(leftLogin, leftName) - bucket(rightLogin, rightName) ||
      left.rank - right.rank ||
      leftLogin.localeCompare(rightLogin)
    );
  };
}

function normalizeSearchLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ");
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function uniquePeriods(periods: Iterable<string>): string[] {
  return [...new Set(periods)].sort();
}
