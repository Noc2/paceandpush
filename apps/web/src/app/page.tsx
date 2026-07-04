import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, getMe, parseBoard } from "@/server/data/read-model";
import type { Board, LeaderboardRow } from "@paceandpush/api-contracts";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";

type HomePageProps = {
  searchParams?: Promise<{
    board?: string;
    period?: string;
  }>;
};

const boards: Array<{ id: Board; label: string }> = [
  { id: "balanced", label: "Balanced" },
  { id: "commits", label: "Commits" },
  { id: "distance", label: "Kilometers" },
];

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const board = parseBoard(params.board ?? null);
  const [leaderboard, me] = await Promise.all([
    getLeaderboard(board, params.period),
    getMe(await getSessionUser()),
  ]);

  return (
    <main className="app-shell">
      <section className="app-frame" aria-label="Pace and Push leaderboard">
        <AppHeader />

        <section className="summary-bar" aria-label="Current score">
          <div>
            <span>{me.login === "guest" ? "Connect GitHub to start" : "Your score"}</span>
            <strong>{me.score.score.toFixed(1)}</strong>
          </div>
          <Stat label="Rank" value={me.score.rank ? `#${me.score.rank}` : "-"} />
          <Stat label="Commits" value={String(me.score.commits)} />
          <Stat label="Kilometers" value={me.score.kilometers.toFixed(1)} />
        </section>

        <BoardTabs active={leaderboard.board} />
        <LeaderboardTable rows={leaderboard.rows} />
      </section>
    </main>
  );
}

function AppHeader() {
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
        <a className="button button-primary" href="/api/github/oauth/start">
          Connect GitHub
        </a>
      </nav>
    </header>
  );
}

function BoardTabs({ active }: { active: Board }) {
  return (
    <nav className="tabs" aria-label="Leaderboard boards">
      {boards.map((board) => (
        <Link
          key={board.id}
          className={board.id === active ? "active" : ""}
          href={`/?board=${board.id}`}
        >
          {board.label}
        </Link>
      ))}
    </nav>
  );
}

function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="leaderboard" role="table" aria-label="Leaderboard">
      <div className="leaderboard-head" role="row">
        <span>#</span>
        <span>Developer</span>
        <span>Score</span>
        <span>Commits</span>
        <span>Km</span>
        <span>Streak</span>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No public scores yet</strong>
          <span>The leaderboard will fill in after users opt in and the score job runs.</span>
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
          <span>{row.kilometers.toFixed(1)}</span>
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
