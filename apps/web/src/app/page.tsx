import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, getMe, parsePeriod, searchPublicUsers } from "@/server/data/read-model";
import type { LeaderboardRow } from "@paceandpush/api-contracts";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
import { PeriodSelector } from "@/app/PeriodSelector";
import {
  distanceUnitAbbreviation,
  formatDistance,
  runningDistanceLabel,
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
  const [leaderboardResult, me] = await Promise.all([
    searchQuery
      ? searchPublicUsers({ period, query: searchQuery })
      : getLeaderboard("balanced", period),
    getMe(await getSessionUser(), period),
  ]);
  const hiddenParams = [
    { name: "sort", value: sort },
    { name: "dir", value: direction },
    ...(searchQuery ? [{ name: "q", value: searchQuery }] : []),
  ];

  return (
    <main className="app-shell">
      <section className="app-frame" aria-label="Pace and Push leaderboard">
        <AppHeader login={me.login} />

        <section className="summary-bar" aria-label="Current score">
          <div>
            <span>{me.login === "guest" ? "Connect GitHub to start" : "Your score"}</span>
            <strong>{me.score.score.toFixed(1)}</strong>
          </div>
          <Stat label="Rank" value={me.score.rank ? `#${me.score.rank}` : "-"} />
          <Stat label="Commits" value={String(me.score.commits)} />
          <Stat label={runningDistanceLabel(me.units)} value={formatDistance(me.score.kilometers, me.units)} />
        </section>

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
        <LeaderboardTable
          rows={leaderboardResult.rows}
          period={leaderboardResult.period}
          query={searchQuery}
          sort={sort}
          direction={direction}
          units={me.units}
        />
      </section>
    </main>
  );
}

function AppHeader({ login }: { login: string }) {
  const signedIn = login !== "guest";

  return (
    <header className="topbar">
      <Link href="/" className="brand-lockup" aria-label={brandName}>
        <span className="logo-mark" aria-hidden="true">
          {promptMark.character}
        </span>
        <span>
          <strong>{brandName}</strong>
          <small>{brandTagline}</small>
        </span>
      </Link>

      <nav className="top-actions" aria-label="Primary navigation">
        <Link className="button" href="/settings">
          Settings
        </Link>
        {signedIn ? (
          <Link className="button button-primary" href="/settings">
            @{login}
          </Link>
        ) : (
          <a className="button button-primary" href="/api/github/oauth/start">
            Connect GitHub
          </a>
        )}
      </nav>
    </header>
  );
}

function LeaderboardTable({
  rows,
  period,
  query,
  sort,
  direction,
  units,
}: {
  rows: LeaderboardRow[];
  period: string;
  query: string;
  sort: LeaderboardSort;
  direction: SortDirection;
  units: UnitPreference;
}) {
  const sortedRows = sortLeaderboardRows(rows, sort, direction);
  const emptyState = getEmptyState(query);

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
      {sortedRows.map((row, index) => (
        <Link
          href={`/users/${encodeURIComponent(row.login)}?period=${period}`}
          className="leaderboard-row"
          role="row"
          key={row.login}
        >
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span className="developer">
            <strong>{row.login}</strong>
            <small>{row.displayName}</small>
          </span>
          <strong>{row.score.toFixed(1)}</strong>
          <span>{row.commits}</span>
          <span>{formatDistance(row.kilometers, units)}</span>
          <span>{row.streakDays}d</span>
        </Link>
      ))}
    </div>
  );
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
