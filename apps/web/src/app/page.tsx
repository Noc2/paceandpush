import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, getMe, parsePeriod } from "@/server/data/read-model";
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
  const [leaderboard, me] = await Promise.all([
    getLeaderboard("balanced", period),
    getMe(await getSessionUser(), period),
  ]);

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
          activePeriod={leaderboard.period}
          action="/"
          hiddenParams={[
            { name: "sort", value: sort },
            { name: "dir", value: direction },
          ]}
        />
        <LeaderboardTable
          rows={leaderboard.rows}
          period={leaderboard.period}
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
  sort,
  direction,
  units,
}: {
  rows: LeaderboardRow[];
  period: string;
  sort: LeaderboardSort;
  direction: SortDirection;
  units: UnitPreference;
}) {
  const sortedRows = sortLeaderboardRows(rows, sort, direction);

  return (
    <div className="leaderboard" role="table" aria-label="Leaderboard">
      <div className="leaderboard-head" role="row">
        <span role="columnheader">#</span>
        <SortHeader
          column="developer"
          direction={direction}
          label="Developer"
          period={period}
          sort={sort}
        />
        <SortHeader
          column="score"
          direction={direction}
          label="Score"
          period={period}
          sort={sort}
        />
        <SortHeader
          column="commits"
          direction={direction}
          label="Commits"
          period={period}
          sort={sort}
        />
        <SortHeader
          column="distance"
          direction={direction}
          label={runningDistanceShortLabel(units)}
          period={period}
          sort={sort}
        />
        <SortHeader
          column="streak"
          direction={direction}
          label="Streak"
          period={period}
          sort={sort}
        />
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No public scores yet</strong>
          <span>The leaderboard will fill in after activity is synced and the score job runs.</span>
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

function SortHeader({
  column,
  direction,
  label,
  period,
  sort,
}: {
  column: LeaderboardSort;
  direction: SortDirection;
  label: string;
  period: string;
  sort: LeaderboardSort;
}) {
  const isActive = column === sort;
  const nextDirection = isActive ? toggleSortDirection(direction) : defaultSortDirection(column);
  const ariaSort = isActive ? (direction === "asc" ? "ascending" : "descending") : "none";

  return (
    <span role="columnheader" aria-sort={ariaSort}>
      <Link
        className={isActive ? "leaderboard-sort-link active" : "leaderboard-sort-link"}
        href={leaderboardSortHref(period, column, nextDirection)}
        aria-label={`Sort by ${label} ${nextDirection === "asc" ? "ascending" : "descending"}`}
      >
        <span>{label}</span>
        {isActive ? <span className={`sort-icon ${direction}`} aria-hidden="true" /> : null}
      </Link>
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
): string {
  const params = new URLSearchParams({
    period,
    sort,
    dir: direction,
  });

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
