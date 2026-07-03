import { getLeaderboard, getPublicProfile } from "@/server/data/read-model";
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
  const profile = await getPublicProfile(decodeURIComponent(login));
  if (!profile) notFound();

  const leaderboard = await getLeaderboard();
  const row = leaderboard.rows.find(
    (leader) => leader.login.toLowerCase() === profile.login.toLowerCase(),
  );

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label={`${profile.login} profile`}>
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
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </header>

        <section className="profile-hero">
          <p className="section-label">Developer profile</p>
          <h1>@{profile.login}</h1>
          <p>{profile.bio}</p>
        </section>

        <div className="stats-list">
          <Stat label="Score" value={profile.score.score.toFixed(1)} />
          <Stat label="Commits" value={String(profile.score.commits)} />
          <Stat label="Kilometers" value={profile.score.kilometers.toFixed(1)} />
          <Stat label="Streak" value={`${row?.streakDays ?? 0}d`} />
        </div>

        <section className="history-list" aria-label="July history">
          <h2>July history</h2>
          {profile.history.map((point) => (
            <div key={point.date}>
              <span>{point.date}</span>
              <strong>{point.score.toFixed(1)}</strong>
              <span>{point.commits} commits</span>
              <span>{point.kilometers.toFixed(1)} km</span>
            </div>
          ))}
        </section>
      </section>
    </main>
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
