"use client";

import { brandName } from "@paceandpush/brand";
import { useEffect, useState } from "react";
import { useThemeSignature } from "@/app/useThemeSignature";

type EmbedTheme = "light" | "dark";

type ProfileChartEmbedProps = {
  darkChartPath: string;
  darkEmbedMarkdown: string;
  distanceLabel: string;
  lightChartPath: string;
  lightEmbedMarkdown: string;
  login: string;
};

export function ProfileChartEmbed({
  darkChartPath,
  darkEmbedMarkdown,
  distanceLabel,
  lightChartPath,
  lightEmbedMarkdown,
  login,
}: ProfileChartEmbedProps) {
  const themeSignature = useThemeSignature();
  const [resolvedTheme, setResolvedTheme] = useState<EmbedTheme>("light");

  useEffect(() => {
    setResolvedTheme(readResolvedTheme());
  }, [themeSignature]);

  const chartPath = resolvedTheme === "dark" ? darkChartPath : lightChartPath;
  const embedMarkdown = resolvedTheme === "dark" ? darkEmbedMarkdown : lightEmbedMarkdown;
  const themeLabel = resolvedTheme === "dark" ? "Dark" : "Light";

  return (
    <>
      <div className="profile-chart-previews">
        <object
          aria-label={`${brandName} ${resolvedTheme} chart for ${login}`}
          className="profile-chart"
          data={chartPath}
          type="image/svg+xml"
        >
          <img
            src={chartPath}
            alt={`${brandName} ${resolvedTheme} chart for ${login}`}
          />
        </object>
      </div>
      <div className="chart-panel-copy">
        <p className="section-label">Profile chart</p>
        <h2>Embed it on GitHub</h2>
        <p>
          A lightweight SVG card for profile READMEs with your score trend,
          commits, and {distanceLabel}.
        </p>
        <div className="embed-code-list">
          <div>
            <span>{themeLabel}</span>
            <code>{embedMarkdown}</code>
          </div>
        </div>
      </div>
    </>
  );
}

function readResolvedTheme(): EmbedTheme {
  const selectedTheme = document.documentElement.dataset.theme;
  if (selectedTheme === "dark" || selectedTheme === "light") {
    return selectedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
