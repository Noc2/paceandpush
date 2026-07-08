export const brandName = "Pace & Push";

export const brandTagline = "Run. Commit. Repeat.";

export const brandThemes = {
  light: {
    paper: "#ffffff",
    surfaceBright: "#ffffff",
    surfacePanel: "#f6f8fa",
    surfacePanelHigh: "#eaeef2",
    surfaceInset: "#d8dee4",
    paperRaised: "#ffffff",
    ink: "#1f2328",
    mutedInk: "#59636e",
    line: "#d0d7de",
    lineStrong: "#8c959f",
    commitGreen: "#1a7f37",
    distanceCoral: "#cf222e",
    secondaryOrange: "#f97316",
    rankBlue: "#0969da",
    warmHighlight: "#fff8c5",
    danger: "#cf222e",
    success: "#1a7f37",
    overlay: "rgba(31, 35, 40, 0.36)",
    shadow: "rgba(31, 35, 40, 0.16)",
    hoverWash: "rgba(31, 35, 40, 0.04)",
    accentWash: "rgba(249, 115, 22, 0.1)",
    successWash: "rgba(26, 127, 55, 0.1)",
  },
  dark: {
    paper: "#0d1117",
    surfaceBright: "#161b22",
    surfacePanel: "#161b22",
    surfacePanelHigh: "#21262d",
    surfaceInset: "#30363d",
    paperRaised: "#161b22",
    ink: "#e6edf3",
    mutedInk: "#8b949e",
    line: "#30363d",
    lineStrong: "#6e7681",
    commitGreen: "#3fb950",
    distanceCoral: "#ff7b72",
    secondaryOrange: "#f97316",
    rankBlue: "#58a6ff",
    warmHighlight: "#d29922",
    danger: "#ff7b72",
    success: "#3fb950",
    overlay: "rgba(1, 4, 9, 0.62)",
    shadow: "rgba(1, 4, 9, 0.32)",
    hoverWash: "rgba(230, 237, 243, 0.06)",
    accentWash: "rgba(249, 115, 22, 0.16)",
    successWash: "rgba(63, 185, 80, 0.14)",
  },
} as const;

export type BrandThemeName = keyof typeof brandThemes;

export type BrandThemeColors = (typeof brandThemes)[BrandThemeName];

export const brandColors = brandThemes.light;

export const brandRadius = {
  github: 6,
  css: "6px",
} as const;

export function getBrandTheme(theme: string | null | undefined): BrandThemeColors {
  return theme === "dark" ? brandThemes.dark : brandThemes.light;
}

export const brandTypography = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const promptMark = {
  label: "Pace and Push prompt mark",
  character: ">",
} as const;

export const cssVariables = `${themeCssVariables(":root, [data-theme=\"light\"]", "light", brandThemes.light)}

[data-theme="dark"] {
${themeCssDeclarations("dark", brandThemes.dark)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${themeCssDeclarations("dark", brandThemes.dark)}
  }
}`;

function themeCssVariables(
  selector: string,
  colorScheme: BrandThemeName,
  colors: BrandThemeColors,
): string {
  return `${selector} {
${themeCssDeclarations(colorScheme, colors)}
}`;
}

function themeCssDeclarations(colorScheme: BrandThemeName, colors: BrandThemeColors): string {
  return [
    `  color-scheme: ${colorScheme};`,
    `  --paper: ${colors.paper};`,
    `  --surface-bright: ${colors.surfaceBright};`,
    `  --surface-panel: ${colors.surfacePanel};`,
    `  --surface-panel-high: ${colors.surfacePanelHigh};`,
    `  --surface-inset: ${colors.surfaceInset};`,
    `  --paper-2: ${colors.surfaceBright};`,
    `  --ink: ${colors.ink};`,
    `  --muted: ${colors.mutedInk};`,
    `  --line: ${colors.line};`,
    `  --line-strong: ${colors.lineStrong};`,
    `  --green: ${colors.commitGreen};`,
    `  --coral: ${colors.distanceCoral};`,
    `  --orange: ${colors.secondaryOrange};`,
    `  --blue: ${colors.rankBlue};`,
    `  --yellow: ${colors.warmHighlight};`,
    `  --score: ${colors.secondaryOrange};`,
    `  --commits: ${colors.commitGreen};`,
    `  --distance: ${colors.rankBlue};`,
    `  --danger: ${colors.danger};`,
    `  --success: ${colors.success};`,
    `  --overlay: ${colors.overlay};`,
    `  --shadow: ${colors.shadow};`,
    `  --hover-wash: ${colors.hoverWash};`,
    `  --accent-wash: ${colors.accentWash};`,
    `  --success-wash: ${colors.successWash};`,
    `  --corner-radius: ${brandRadius.css};`,
  ].join("\n");
}
