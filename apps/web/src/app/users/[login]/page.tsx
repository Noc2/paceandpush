import { getLeaderboard, getPublicProfile } from "@/server/data/read-model";
import type { ProfileHistoryPoint } from "@paceandpush/api-contracts";
import { brandName, brandTagline, promptMark } from "@paceandpush/brand";
import Link from "next/link";
import { notFound } from "next/navigation";

type UserPageProps = {
  params: Promise<{
    login: string;
  }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { login } = await params;
  const profile = getPublicProfile(decodeURIComponent(login));
  if (!profile) notFound();

  const leaderboard = getLeaderboard();
  const row = leaderboard.rows.find(
    (leader) => leader.login.toLowerCase() === profile.login.toLowerCase(),
  );

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label={`${profile.login} profile`}>
        <header className="topbar">
          <Link href="/" className="brand-lockup" aria-label={brandName}>
            <img src={promptMark.assetPath} alt="" className="brand-mark" />
            <span>
              <strong>{brandName}</strong>
              <small>{brandTagline}</small>
            </span>
          </Link>
          <Link className="button" href="/">
            <span aria-hidden="true">&lt;</span>
            Board
          </Link>
        </header>

        <section className="profile-hero">
          <span className="avatar avatar-large">{initials(profile.displayName)}</span>
          <div>
            <p className="section-label">Developer profile</p>
            <h1>@{profile.login}</h1>
            <p>{profile.bio}</p>
          </div>
        </section>

        <div className="metric-grid">
          <Metric title="Score" value={profile.score.score.toFixed(1)} tone="blue" />
          <Metric title="Commits" value={String(profile.score.commits)} tone="green" />
          <Metric title="Distance" value={profile.score.kilometers.toFixed(1)} tone="coral" />
          <Metric title="Streak" value={`${row?.streakDays ?? 0}d`} tone="ink" />
        </div>

        <section className="profile-strip">
          <div>
            <p className="section-label">July history</p>
            <h2>Balanced progress</h2>
            <p>Commits and kilometers are rolled up by day.</p>
          </div>
          <HistoryBars points={profile.history} />
        </section>
      </section>
    </main>
  );
}

function Metric({
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
