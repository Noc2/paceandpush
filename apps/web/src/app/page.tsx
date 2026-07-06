import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, getMe, parseBoard, parsePeriod } from "@/server/data/read-model";
import type { Board, LeaderboardRow } from "@paceandpush/api-contracts";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
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
    period?: string;
  }>;
};

type PeriodOption = {
  label: string;
  value: string;
};

type PeriodOptionGroup = {
  label: string;
  options: PeriodOption[];
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const board = parseBoard(params.board ?? null);
  const period = parsePeriod(params.period ?? null);
  const [leaderboard, me] = await Promise.all([
    getLeaderboard(board, period),
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

        <PeriodSelector activePeriod={leaderboard.period} board={leaderboard.board} />
        <BoardTabs active={leaderboard.board} period={leaderboard.period} units={me.units} />
        <LeaderboardTable rows={leaderboard.rows} units={me.units} />
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

function PeriodSelector({ activePeriod, board }: { activePeriod: string; board: Board }) {
  const optionGroups = getPeriodOptionGroups(activePeriod);

  return (
    <form className="period-selector" action="/" method="get" aria-label="Score period">
      <input type="hidden" name="board" value={board} />
      <label htmlFor="period">Period</label>
      <select id="period" name="period" defaultValue={activePeriod}>
        {optionGroups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button className="button" type="submit">
        Apply
      </button>
    </form>
  );
}

function BoardTabs({
  active,
  period,
  units,
}: {
  active: Board;
  period: string;
  units: UnitPreference;
}) {
  const boards: Array<{ id: Board; label: string }> = [
    { id: "balanced", label: "Balanced" },
    { id: "commits", label: "Commits" },
    { id: "distance", label: runningDistanceShortLabel(units) },
  ];

  return (
    <nav className="tabs" aria-label="Leaderboard boards">
      {boards.map((board) => (
        <Link
          key={board.id}
          className={board.id === active ? "active" : ""}
          href={`/?board=${board.id}&period=${period}`}
        >
          {board.label}
        </Link>
      ))}
    </nav>
  );
}

function LeaderboardTable({ rows, units }: { rows: LeaderboardRow[]; units: UnitPreference }) {
  return (
    <div className="leaderboard" role="table" aria-label="Leaderboard">
      <div className="leaderboard-head" role="row">
        <span>#</span>
        <span>Developer</span>
        <span>Score</span>
        <span>Commits</span>
        <span>{runningDistanceShortLabel(units)}</span>
        <span>Streak</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No public scores yet</strong>
          <span>The leaderboard will fill in after activity is synced and the score job runs.</span>
        </div>
      ) : null}
      {rows.map((row) => (
        <Link
          href={`/users/${row.login}`}
          className="leaderboard-row"
          role="row"
          key={row.login}
        >
          <span>{String(row.rank).padStart(2, "0")}</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPeriodOptionGroups(activePeriod: string): PeriodOptionGroup[] {
  const now = new Date();
  const years = new Set<string>();
  const months = new Set<string>();
  const weeks = new Set<string>();

  for (let offset = 0; offset < 5; offset += 1) {
    years.add(String(now.getUTCFullYear() - offset));
  }
  for (let offset = 0; offset < 12; offset += 1) {
    months.add(toMonthPeriod(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))));
  }
  for (let offset = 0; offset < 12; offset += 1) {
    weeks.add(toIsoWeekPeriod(addDays(now, -offset * 7)));
  }

  if (/^\d{4}$/.test(activePeriod)) {
    years.add(activePeriod);
  } else if (/^\d{4}-W\d{2}$/.test(activePeriod)) {
    weeks.add(activePeriod);
  } else {
    months.add(activePeriod);
  }

  return [
    {
      label: "Years",
      options: [...years].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
    {
      label: "Months",
      options: [...months].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
    {
      label: "Weeks",
      options: [...weeks].sort().reverse().map((period) => ({
        label: formatPeriodLabel(period),
        value: period,
      })),
    },
  ];
}

function toMonthPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function formatPeriodLabel(period: string): string {
  if (/^\d{4}$/.test(period)) {
    return period;
  }

  const weekMatch = /^(\d{4})-W(\d{2})$/.exec(period);
  if (weekMatch) {
    return `Week ${Number(weekMatch[2])}, ${weekMatch[1]}`;
  }

  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function toIsoWeekPeriod(date: Date): string {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);

  const isoYear = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1) / 7);

  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
