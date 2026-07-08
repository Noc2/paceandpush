import type { ProfileHistoryPoint, PublicProfileResponse } from "@paceandpush/api-contracts";
import {
  brandRadius,
  brandName,
  getBrandTheme,
  promptMark,
  type BrandThemeColors,
  type BrandThemeName,
} from "@paceandpush/brand";
import {
  distanceUnitAbbreviation,
  formatDistance,
  type UnitPreference,
} from "@/lib/distance-units";

const chartWidth = 720;
const chartHeight = 360;
const cornerRadius = brandRadius.github;
const homepageUrl = "https://paceandpush.com";
const homepageLabel = "paceandpush.com";
const seriesLegend = [
  { label: "Score", color: "secondaryOrange" },
  { label: "Commits", color: "commitGreen" },
  { label: "Run", color: "rankBlue" },
] as const;
const plot = {
  x: 38,
  y: 124,
  width: 644,
  height: 164,
};
const metrics = {
  x: 414,
  commitsX: 92,
  distanceX: chartWidth - 38 - 414,
};

export function renderProfileChartSvg(
  profile: PublicProfileResponse,
  units: UnitPreference = "metric",
  theme: ProfileChartTheme = "light",
): string {
  const colors = getBrandTheme(theme);
  const history = profile.history.length > 0 ? profile.history : [emptyPoint()];
  const maxScore = Math.max(...history.map((point) => point.score), 1);
  const maxDistance = Math.max(...history.map((point) => point.kilometers), 1);
  const dailyCommits = toDailyValues(history.map((point) => point.commits));
  const maxDailyCommits = Math.max(...dailyCommits, 1);
  const visibleLogin = truncateSvgText(profile.login, 34);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(brandName)} chart for ${escapeXml(profile.login)}</title>
  <desc id="desc">Monthly Pace and Push score, commit, and running distance summary for ${escapeXml(profile.login)}.</desc>
  <rect width="${chartWidth}" height="${chartHeight}" rx="${cornerRadius}" fill="${colors.surfacePanel}"/>
  <rect x="0.5" y="0.5" width="${chartWidth - 1}" height="${chartHeight - 1}" rx="${cornerRadius}" fill="none" stroke="${colors.lineStrong}" stroke-opacity="0.7"/>

  <g transform="translate(30 28)">
    <rect width="34" height="34" rx="${cornerRadius}" fill="${colors.secondaryOrange}" stroke="${colors.ink}" stroke-width="1"/>
    <text x="17" y="25" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="900" fill="${colors.ink}">${escapeXml(promptMark.character)}</text>
    <text x="48" y="16" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" fill="${colors.ink}">${escapeXml(brandName)}</text>
    <text x="48" y="36" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="13" font-weight="650" fill="${colors.mutedInk}">${escapeXml(visibleLogin)}</text>
  </g>

  <g transform="translate(${metrics.x} 28)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    ${metricText(0, "Score", profile.score.score.toFixed(1), colors.secondaryOrange, colors)}
    ${metricText(metrics.commitsX, "Commits", String(profile.score.commits), colors.commitGreen, colors)}
    ${metricText(metrics.distanceX, `Run ${distanceUnitAbbreviation(units)}`, formatDistance(profile.score.kilometers, units), colors.rankBlue, colors, "end")}
  </g>

  <g>
    ${gridLines(colors)}
    ${buildCommitBars(dailyCommits, maxDailyCommits, colors)}
    <path d="${buildAreaPath(history, maxScore)}" fill="${colors.secondaryOrange}" fill-opacity="0.22"/>
    <path d="${buildLinePath(history, maxScore)}" fill="none" stroke="${colors.secondaryOrange}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${buildLinePath(history, maxScore)}" fill="none" stroke="${colors.ink}" stroke-width="1.2" stroke-opacity="0.35" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${buildDistanceLinePath(history, maxDistance)}" fill="none" stroke="${colors.rankBlue}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="8 7"/>
  </g>

  <g transform="translate(${plot.x} 302)" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="800">
    ${legendItems(colors, units)}
  </g>

  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="12" font-weight="700" fill="${colors.mutedInk}">
    <text x="${plot.x}" y="320">${escapeXml(history[0]?.date.slice(5) ?? "")}</text>
    <text x="${plot.x + plot.width / 2}" y="320" text-anchor="middle">${escapeXml(history[Math.floor((history.length - 1) / 2)]?.date.slice(5) ?? "")}</text>
    <text x="${plot.x + plot.width}" y="320" text-anchor="end">${escapeXml(history[history.length - 1]?.date.slice(5) ?? "")}</text>
  </g>
  <a href="${homepageUrl}" target="_blank" rel="noopener noreferrer">
    <text x="${plot.x + plot.width}" y="344" text-anchor="end" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="11" font-weight="750" fill="${colors.secondaryOrange}">${escapeXml(homepageLabel)}</text>
  </a>
</svg>`;
}

export type ProfileChartTheme = Extract<BrandThemeName, "light" | "dark">;

export function parseProfileChartTheme(value: string | null): ProfileChartTheme {
  return value === "dark" ? "dark" : "light";
}

function metricText(
  x: number,
  label: string,
  value: string,
  color: string,
  colors: BrandThemeColors,
  anchor: "start" | "end" = "start",
): string {
  return `<g transform="translate(${x} 0)">
    <text x="0" y="12" text-anchor="${anchor}" font-size="11" font-weight="800" fill="${colors.mutedInk}">${escapeXml(label.toUpperCase())}</text>
    <text x="0" y="36" text-anchor="${anchor}" font-size="25" font-weight="900" fill="${color}">${escapeXml(value)}</text>
  </g>`;
}

function gridLines(colors: BrandThemeColors): string {
  return [0, 0.33, 0.66, 1]
    .map((ratio) => {
      const y = plot.y + plot.height - plot.height * ratio;
      return `<line x1="${plot.x}" y1="${round(y)}" x2="${plot.x + plot.width}" y2="${round(y)}" stroke="${colors.line}" stroke-width="1"/>`;
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

function buildDistanceLinePath(history: ProfileHistoryPoint[], maxDistance: number): string {
  return scaledDistancePoints(history, maxDistance)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildCommitBars(
  dailyCommits: number[],
  maxDailyCommits: number,
  colors: BrandThemeColors,
): string {
  const count = Math.max(dailyCommits.length, 1);
  const slotWidth = plot.width / count;
  const barWidth = Math.min(8, slotWidth >= 2 ? slotWidth * 0.62 : slotWidth);

  return dailyCommits
    .map((value, index) => {
      const height = Math.max(3, (value / maxDailyCommits) * (plot.height * 0.52));
      const x = plot.x + index * slotWidth + (slotWidth - barWidth) / 2;
      const y = plot.y + plot.height - height;
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(barWidth)}" height="${round(height)}" rx="${cornerRadius}" fill="${colors.commitGreen}" fill-opacity="0.28"/>`;
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

function scaledDistancePoints(history: ProfileHistoryPoint[], maxDistance: number) {
  const denominator = Math.max(history.length - 1, 1);
  return history.map((point, index) => ({
    x: round(plot.x + (index / denominator) * plot.width),
    y: round(plot.y + plot.height - (point.kilometers / maxDistance) * plot.height),
  }));
}

function legendItems(colors: BrandThemeColors, units: UnitPreference): string {
  let x = 0;
  return seriesLegend
    .map((item) => {
      const label = item.label === "Run" ? `Run ${distanceUnitAbbreviation(units)}` : item.label;
      const text = `<g transform="translate(${x} 0)">
      <circle cx="4" cy="4" r="4" fill="${colors[item.color]}"/>
      <text x="14" y="8" fill="${colors[item.color]}">${escapeXml(label)}</text>
    </g>`;
      x += label.length * 7 + 42;
      return text;
    })
    .join("");
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

function truncateSvgText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}
