import { ScoreExplainer } from "@/app/ScoreExplainer";
import { SiteHeader } from "@/app/SiteHeader";
import {
  distanceUnitAbbreviation,
  formatDistance,
  runningDistanceLabel,
  runningDistanceShortLabel,
} from "@/lib/distance-units";
import { getLeaderboard, getPublicProfile, parsePeriod } from "@/server/data/read-model";
import { brandName } from "@paceandpush/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PeriodSelector } from "@/app/PeriodSelector";
import { formatPeriodLabel } from "@/lib/periods";
import { ProfileChartEmbed } from "./ProfileChartEmbed";

type UserPageProps = {
  params: Promise<{
    login: string;
  }>;
  searchParams?: Promise<{
    period?: string;
  }>;
};

export default async function UserPage({ params, searchParams }: UserPageProps) {
  const { login } = await params;
  const query = searchParams ? await searchParams : {};
  const period = parsePeriod(query.period ?? null);
  const profile = await getPublicProfile(decodeURIComponent(login), period);
  if (!profile) notFound();

  const units = "metric";
  const leaderboard = await getLeaderboard("balanced", period);
  const row = leaderboard.rows.find(
    (leader) => leader.login.toLowerCase() === profile.login.toLowerCase(),
  );
  const lightChartParams = new URLSearchParams({ period: profile.score.period, units, theme: "light" });
  const darkChartParams = new URLSearchParams({ period: profile.score.period, units, theme: "dark" });
  const lightChartPath = `/api/embed/${encodeURIComponent(profile.login)}/chart.svg?${lightChartParams}`;
  const darkChartPath = `/api/embed/${encodeURIComponent(profile.login)}/chart.svg?${darkChartParams}`;
  const homepageUrl = "https://paceandpush.com/";
  const lightEmbedMarkdown = `[![${brandName} chart](https://paceandpush.com${lightChartPath})](${homepageUrl})`;
  const darkEmbedMarkdown = `[![${brandName} chart](https://paceandpush.com${darkChartPath})](${homepageUrl})`;
  const periodLabel = formatPeriodLabel(profile.score.period);

  return (
    <main className="app-shell">
      <section className="app-frame profile-page" aria-label={`${profile.login} profile`}>
        <SiteHeader compact>
          <Link className="button" href="/">
            Leaderboard
          </Link>
        </SiteHeader>

        <section className="profile-hero">
          <p className="section-label">Developer profile</p>
          <h1>@{profile.login}</h1>
          <p>{profile.bio}</p>
        </section>

        <div className="stats-list">
          <Stat label="Score" value={profile.score.score.toFixed(1)} />
          <Stat label="Commits" value={String(profile.score.commits)} />
          <Stat label={runningDistanceLabel(units)} value={formatDistance(profile.score.kilometers, units)} />
          <Stat label="Streak" value={`${row?.streakDays ?? 0}d`} />
        </div>
        <ScoreExplainer />

        <PeriodSelector
          activePeriod={profile.score.period}
          action={`/users/${encodeURIComponent(profile.login)}`}
        />

        <section className="chart-panel" aria-label="Embeddable profile chart">
          <ProfileChartEmbed
            darkChartPath={darkChartPath}
            darkEmbedMarkdown={darkEmbedMarkdown}
            distanceLabel={runningDistanceShortLabel(units).toLowerCase()}
            lightChartPath={lightChartPath}
            lightEmbedMarkdown={lightEmbedMarkdown}
            login={profile.login}
          />
        </section>

        <section className="history-list" aria-label={`${periodLabel} history`}>
          <h2>{periodLabel} history</h2>
          {profile.history.map((point) => (
            <div key={point.date}>
              <span>{point.date}</span>
              <strong>{point.score.toFixed(1)}</strong>
              <span>{point.commits} commits</span>
              <span>
                {formatDistance(point.kilometers, units)} {distanceUnitAbbreviation(units)}
              </span>
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
