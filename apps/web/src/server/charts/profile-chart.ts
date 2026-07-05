import type { ProfileHistoryPoint, PublicProfileResponse } from "@paceandpush/api-contracts";
import { brandColors, brandName, promptMark } from "@paceandpush/brand";
import {
  distanceUnitAbbreviation,
  formatDistance,
  type UnitPreference,
} from "@/lib/distance-units";

const chartWidth = 720;
const chartHeight = 360;
const plot = {
  x: 38,
  y: 124,
  width: 644,
  height: 164,
};

export function renderProfileChartSvg(
  profile: PublicProfileResponse,
  units: UnitPreference = "metric",
): string {
  const history = profile.history.length > 0 ? profile.history : [emptyPoint()];
  const maxScore = Math.max(...history.map((point) => point.score), 1);
  const dailyCommits = toDailyValues(history.map((point) => point.commits));
  const maxDailyCommits = Math.max(...dailyCommits, 1);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(brandName)} chart for ${escapeXml(profile.login)}</title>
  <desc id="desc">Monthly Pace and Push score, commit, and running distance summary for ${escapeXml(profile.displayName)}.</desc>
  <rect width="${chartWidth}" height="${chartHeight}" rx="18" fill="${brandColors.paper}"/>
  <rect x="0.5" y="0.5" width="${chartWidth - 1}" height="${chartHeight - 1}" rx="17.5" fill="none" stroke="${brandColors.ink}" stroke-opacity="0.12"/>

  <g transform="translate(30 28)">
    <rect width="34" height="34" fill="${brandColors.secondaryOrange}" stroke="${brandColors.ink}" stroke-width="2"/>
    <text x="17" y="25" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="900" fill="${brandColors.ink}">${escapeXml(promptMark.character)}</text>
    <text x="48" y="16" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" fill="${brandColors.ink}">@${escapeXml(profile.login)}</text>
    <text x="48" y="36" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="650" fill="${brandColors.mutedInk}">${escapeXml(profile.displayName)}</text>
  </g>

  <g transform="translate(442 28)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    ${metricText(0, "Score", profile.score.score.toFixed(1), brandColors.rankBlue)}
    ${metricText(92, "Commits", String(profile.score.commits), brandColors.commitGreen)}
    ${metricText(206, `Run ${distanceUnitAbbreviation(units)}`, formatDistance(profile.score.kilometers, units), brandColors.secondaryOrange)}
  </g>

  <g>
    ${gridLines()}
    ${buildCommitBars(dailyCommits, maxDailyCommits)}
    <path d="${buildAreaPath(history, maxScore)}" fill="${brandColors.secondaryOrange}" fill-opacity="0.22"/>
    <path d="${buildLinePath(history, maxScore)}" fill="none" stroke="${brandColors.secondaryOrange}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${buildLinePath(history, maxScore)}" fill="none" stroke="${brandColors.ink}" stroke-width="1.2" stroke-opacity="0.35" stroke-linejoin="round" stroke-linecap="round"/>
  </g>

  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="700" fill="${brandColors.mutedInk}">
    <text x="${plot.x}" y="320">${escapeXml(history[0]?.date.slice(5) ?? "")}</text>
    <text x="${plot.x + plot.width / 2}" y="320" text-anchor="middle">${escapeXml(history[Math.floor((history.length - 1) / 2)]?.date.slice(5) ?? "")}</text>
    <text x="${plot.x + plot.width}" y="320" text-anchor="end">${escapeXml(history[history.length - 1]?.date.slice(5) ?? "")}</text>
  </g>
</svg>`;
}

function metricText(x: number, label: string, value: string, color: string): string {
  return `<g transform="translate(${x} 0)">
    <text x="0" y="12" font-size="11" font-weight="800" fill="${brandColors.mutedInk}">${escapeXml(label.toUpperCase())}</text>
    <text x="0" y="36" font-size="25" font-weight="900" fill="${color}">${escapeXml(value)}</text>
  </g>`;
}

function gridLines(): string {
  return [0, 0.33, 0.66, 1]
    .map((ratio) => {
      const y = plot.y + plot.height - plot.height * ratio;
      return `<line x1="${plot.x}" y1="${round(y)}" x2="${plot.x + plot.width}" y2="${round(y)}" stroke="${brandColors.line}" stroke-width="1"/>`;
    })
    .join("");
}

function buildAreaPath(history: ProfileHistoryPoint[], maxScore: number): string {
  const points = scaledScorePoints(history, maxScore);
  const baseline = plot.y + plot.height;
  return [
    `M ${points[0].x} ${baseline}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1].x} ${baseline}`,
    "Z",
  ].join(" ");
}

function buildLinePath(history: ProfileHistoryPoint[], maxScore: number): string {
  return scaledScorePoints(history, maxScore)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildCommitBars(dailyCommits: number[], maxDailyCommits: number): string {
  const count = Math.max(dailyCommits.length, 1);
  const gap = 6;
  const barWidth = Math.max(8, (plot.width - gap * (count - 1)) / count);

  return dailyCommits
    .map((value, index) => {
      const height = Math.max(3, (value / maxDailyCommits) * (plot.height * 0.52));
      const x = plot.x + index * (barWidth + gap);
      const y = plot.y + plot.height - height;
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barWidth)}" height="${round(height)}" rx="2" fill="${brandColors.commitGreen}" fill-opacity="0.28"/>`;
    })
    .join("");
}

function scaledScorePoints(history: ProfileHistoryPoint[], maxScore: number) {
  const denominator = Math.max(history.length - 1, 1);
  return history.map((point, index) => ({
    x: round(plot.x + (index / denominator) * plot.width),
    y: round(plot.y + plot.height - (point.score / maxScore) * plot.height),
  }));
}

function toDailyValues(cumulativeValues: number[]): number[] {
  let previous = 0;
  return cumulativeValues.map((value) => {
    const delta = Math.max(0, value - previous);
    previous = value;
    return delta;
  });
}

function emptyPoint(): ProfileHistoryPoint {
  return {
    date: new Date().toISOString().slice(0, 10),
    commits: 0,
    kilometers: 0,
    score: 0,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
