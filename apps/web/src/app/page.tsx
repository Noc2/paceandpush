import { AppDownloadActions } from "@/app/AppDownloadActions";
import { ScoreExplainer } from "@/app/ScoreExplainer";
import { SiteHeader } from "@/app/SiteHeader";
import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, parsePeriod, searchPublicUsers } from "@/server/data/read-model";
import type { LeaderboardRow } from "@paceandpush/api-contracts";
import Link from "next/link";
import { PeriodSelector } from "@/app/PeriodSelector";
import {
  formatDistance,
  runningDistanceShortLabel,
  type UnitPreference,
} from "@/lib/distance-units";

type HomePageProps = {
  searchParams?: Promise<{
    board?: string;
    dir?: string;
    period?: string;
    q?: string;
    sort?: string;
  }>;
};

type LeaderboardSort = "developer" | "score" | "commits" | "distance" | "streak";
type SortDirection = "asc" | "desc";

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const period = parsePeriod(params.period ?? null);
  const sort = parseLeaderboardSort(params.sort) ?? parseLeaderboardSort(params.board) ?? "score";
  const direction = parseSortDirection(params.dir, sort);
  const searchQuery = parseSearchQuery(params.q);
  const sessionUser = await getSessionUser();
  const leaderboardResult = searchQuery
    ? await searchPublicUsers({ period, query: searchQuery })
    : await getLeaderboard("balanced", period);
  const hiddenParams = [
    { name: "sort", value: sort },
    { name: "dir", value: direction },
    ...(searchQuery ? [{ name: "q", value: searchQuery }] : []),
  ];

  return (
    <main className="app-shell">
      <section className="app-frame" aria-label="Pace and Push leaderboard">
        <SiteHeader>
          <AppDownloadActions />
        </SiteHeader>
        <h1 className="sr-only">Pace & Push leaderboard</h1>

        <PeriodSelector
          activePeriod={leaderboardResult.period}
          action="/"
          hiddenParams={hiddenParams}
        />
        <SearchForm
          direction={direction}
          period={leaderboardResult.period}
          query={searchQuery}
          sort={sort}
        />
        <ScoreExplainer />
        <LeaderboardTable
          rows={leaderboardResult.rows}
          period={leaderboardResult.period}
          query={searchQuery}
          sort={sort}
          direction={direction}
          units="metric"
          signedInLogin={sessionUser?.login ?? null}
        />
      </section>
    </main>
  );
}

function LeaderboardTable({
  rows,
  period,
  query,
  sort,
  direction,
  units,
  signedInLogin,
}: {
  rows: LeaderboardRow[];
  period: string;
  query: string;
  sort: LeaderboardSort;
  direction: SortDirection;
  units: UnitPreference;
  signedInLogin: string | null;
}) {
  const sortedRows = sortLeaderboardRows(rows, sort, direction);
  const emptyState = getEmptyState(query);
  const normalizedSignedInLogin = signedInLogin?.toLowerCase() ?? null;

  return (
    <div className="leaderboard" role="table" aria-label={query ? "Search results" : "Leaderboard"}>
      <div className="leaderboard-head" role="row">
        <span role="columnheader">#</span>
        <SortHeader
          column="developer"
          direction={direction}
          label="Developer"
          period={period}
          query={query}
          sort={sort}
        />
        <SortHeader
          column="score"
          direction={direction}
          label="Score"
          period={period}
          query={query}
          sort={sort}
        />
        <SortHeader
          column="commits"
          direction={direction}
          label="Commits"
          period={period}
          query={query}
          sort={sort}
        />
        <SortHeader
          column="distance"
          direction={direction}
          label={runningDistanceShortLabel(units)}
          period={period}
          query={query}
          sort={sort}
        />
        <SortHeader
          column="streak"
          direction={direction}
          label="Streak"
          period={period}
          query={query}
          sort={sort}
        />
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>{emptyState.title}</strong>
          <span>{emptyState.description}</span>
        </div>
      ) : null}
      {sortedRows.map((row, index) => {
        const displayRank = index + 1;
        const isSignedInUser =
          normalizedSignedInLogin !== null && row.login.toLowerCase() === normalizedSignedInLogin;

        return (
          <Link
            href={`/users/${encodeURIComponent(row.login)}?period=${period}`}
            className={leaderboardRowClassName(displayRank, isSignedInUser)}
            aria-label={`View ${row.login} profile`}
            title={`View ${row.login} profile`}
            role="row"
            key={row.login}
          >
            <span className="rank-cell" role="cell">
              {String(displayRank).padStart(2, "0")}
            </span>
            <span className="developer" role="cell">
              <strong>{row.login}</strong>
              <small>{row.displayName}</small>
            </span>
            <strong role="cell">{row.score.toFixed(1)}</strong>
            <span role="cell">{row.commits}</span>
            <span role="cell">{formatDistance(row.kilometers, units)}</span>
            <span role="cell">{row.streakDays}d</span>
          </Link>
        );
      })}
    </div>
  );
}

function leaderboardRowClassName(rank: number, isSignedInUser: boolean): string {
  return [
    "leaderboard-row",
    rank <= 3 ? "top-rank" : "",
    isSignedInUser ? "signed-in-user" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function SearchForm({
  direction,
  period,
  query,
  sort,
}: {
  direction: SortDirection;
  period: string;
  query: string;
  sort: LeaderboardSort;
}) {
  return (
    <form className="leaderboard-search" action="/" method="get" aria-label="Search public developers">
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="sort" value={sort} />
      <input type="hidden" name="dir" value={direction} />
      <label htmlFor="leaderboard-search">Search</label>
      <div className="leaderboard-search-row">
        <input
          id="leaderboard-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Developer"
          autoComplete="off"
        />
        <button className="button" type="submit">
          Search
        </button>
        {query ? (
          <Link className="button" href={leaderboardSortHref(period, sort, direction)}>
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function SortHeader({
  column,
  direction,
  label,
  period,
  query,
  sort,
}: {
  column: LeaderboardSort;
  direction: SortDirection;
  label: string;
  period: string;
  query: string;
  sort: LeaderboardSort;
}) {
  const isActive = column === sort;
  const nextDirection = isActive ? toggleSortDirection(direction) : defaultSortDirection(column);
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <span role="columnheader" aria-sort={ariaSort}>
      <Link
        className={isActive ? "leaderboard-sort-link active" : "leaderboard-sort-link"}
        href={leaderboardSortHref(period, column, nextDirection, query)}
        aria-label={`Sort by ${label} ${nextDirection === "asc" ? "ascending" : "descending"}`}
      >
        <span>{label}</span>
        {isActive ? <span className={`sort-icon ${direction}`} aria-hidden="true" /> : null}
      </Link>
    </span>
  );
}

function getEmptyState(query: string): { description: string; title: string } {
  if (query.length === 1) {
    return {
      title: "Keep typing",
      description: "Search needs at least 2 characters.",
    };
  }

  if (query) {
    return {
      title: "No matching public developers",
      description: "Try another GitHub handle or display name.",
    };
  }

  return {
    title: "No public scores yet",
    description: "The leaderboard will fill in after activity is synced and the score job runs.",
  };
}

function parseSearchQuery(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function parseLeaderboardSort(value: string | null | undefined): LeaderboardSort | null {
  if (
    value === "developer" ||
    value === "score" ||
    value === "commits" ||
    value === "distance" ||
    value === "streak"
  ) {
    return value;
  }

  if (value === "balanced") return "score";
  return null;
}

function parseSortDirection(
  value: string | null | undefined,
  sort: LeaderboardSort,
): SortDirection {
  if (value === "asc" || value === "desc") return value;
  return defaultSortDirection(sort);
}

function defaultSortDirection(sort: LeaderboardSort): SortDirection {
  return sort === "developer" ? "asc" : "desc";
}

function toggleSortDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

function leaderboardSortHref(
  period: string,
  sort: LeaderboardSort,
  direction: SortDirection,
  query = "",
): string {
  const params = new URLSearchParams({
    period,
    sort,
    dir: direction,
  });
  if (query) params.set("q", query);

  return `/?${params.toString()}`;
}

function sortLeaderboardRows(
  rows: LeaderboardRow[],
  sort: LeaderboardSort,
  direction: SortDirection,
): LeaderboardRow[] {
  return [...rows].sort((left, right) => {
    const primary = compareLeaderboardRows(left, right, sort);
    if (primary !== 0) return direction === "asc" ? primary : -primary;

    const scoreTieBreaker = right.score - left.score;
    if (scoreTieBreaker !== 0) return scoreTieBreaker;

    return left.login.localeCompare(right.login);
  });
}

function compareLeaderboardRows(
  left: LeaderboardRow,
  right: LeaderboardRow,
  sort: LeaderboardSort,
): number {
  if (sort === "developer") {
    return left.login.localeCompare(right.login);
  }

  if (sort === "commits") {
    return left.commits - right.commits;
  }

  if (sort === "distance") {
    return left.kilometers - right.kilometers;
  }

  if (sort === "streak") {
    return left.streakDays - right.streakDays;
  }

  return left.score - right.score;
}
