import { getSessionUser } from "@/server/auth/session";
import { getLeaderboard, getMe, getPublicProfile, parseBoard } from "@/server/data/read-model";
import type { Board, LeaderboardRow, ProfileHistoryPoint } from "@paceandpush/api-contracts";
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
  const leaderboard = getLeaderboard(board, params.period);
  const me = getMe(await getSessionUser());
  const profile = getPublicProfile(me.login);

  return (
    <main className="app-shell">
      <section className="app-frame" aria-label="Pace and Push leaderboard">
        <header className="topbar">
          <Link href="/" className="brand-lockup" aria-label={brandName}>
            <img src={promptMark.assetPath} alt="" className="brand-mark" />
            <span>
              <strong>{brandName}</strong>
              <small>{brandTagline}</small>
            </span>
          </Link>

          <div className="top-actions">
            <select aria-label="Leaderboard period" defaultValue={leaderboard.period}>
              <option value="2026-07">July 2026</option>
            </select>
            <a className="button button-primary" href="/api/github/oauth/start">
              <span aria-hidden="true">^</span>
              Connect GitHub
            </a>
          </div>
        </header>

        <form className="plot-row" action={`/users/${me.login}`}>
          <input
            aria-label="GitHub profile"
            defaultValue={`github.com/${me.login}`}
            name="profile"
            readOnly
          />
          <Link className="button" href={`/users/${me.login}`}>
            <span aria-hidden="true">&gt;</span>
            Plot
          </Link>
        </form>

        <BoardTabs active={leaderboard.board} />

        <LeaderboardTable rows={leaderboard.rows} />

        <section className="score-section" aria-label="Current score">
          <div className="score-copy">
            <p className="section-label">Your July score</p>
            <strong>{me.score.score.toFixed(1)}</strong>
            <span>Rank {me.score.rank ?? "-"} of 128 public profiles this month.</span>
          </div>

          <div className="metric-grid">
            <MetricCard title="Commits" value={String(me.score.commits)} tone="green" />
            <MetricCard title="Distance" value={me.score.kilometers.toFixed(1)} tone="coral" />
            <MetricCard title="Pace" value="+12%" tone="blue" />
            <MetricCard title="Sync" value={me.score.lastSyncAt ? "9m" : "-"} tone="ink" />
          </div>
        </section>

        {profile ? (
          <section className="profile-strip" aria-label="Profile history">
            <div>
              <p className="section-label">Public profile</p>
              <h2>@{profile.login}</h2>
              <p>{profile.bio}</p>
            </div>
            <HistoryBars points={profile.history} />
          </section>
        ) : null}
      </section>
    </main>
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
        <span>Kilometers</span>
        <span>Streak</span>
      </div>
      {rows.map((row) => (
        <Link
          href={`/users/${row.login}`}
          className="leaderboard-row"
          role="row"
          key={row.login}
        >
          <span className="rank">{String(row.rank).padStart(2, "0")}</span>
          <span className="developer">
            <span className="avatar">{initials(row.displayName)}</span>
            <span>
              <strong>{row.login}</strong>
              <small>{row.displayName}</small>
            </span>
          </span>
          <strong className="tone-blue">{row.score.toFixed(1)}</strong>
          <strong className="tone-green">{row.commits}</strong>
          <strong className="tone-coral">{row.kilometers.toFixed(1)}</strong>
          <strong>{row.streakDays}d</strong>
        </Link>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "blue" | "coral" | "green" | "ink";
}) {
  return (
    <div className="metric-card">
      <span>{title}</span>
      <strong className={`tone-${tone}`}>{value}</strong>
    </div>
  );
}

function HistoryBars({ points }: { points: ProfileHistoryPoint[] }) {
  const maxScore = Math.max(...points.map((point) => point.score), 1);

  return (
    <div className="history-bars" aria-label="Score history">
      {points.map((point) => (
        <span key={point.date} title={`${point.date}: ${point.score.toFixed(1)}`}>
          <i style={{ height: `${Math.max(12, (point.score / maxScore) * 100)}%` }} />
          <small>{point.date.slice(5)}</small>
        </span>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
