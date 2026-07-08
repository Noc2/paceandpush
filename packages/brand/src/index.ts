export const brandName = "Pace & Push";

export const brandTagline = "Run. Commit. Repeat.";

export const brandColors = {
  paper: "#fbf7ef",
  surfaceBright: "#fffdf7",
  surfacePanel: "#f8f2e8",
  surfacePanelHigh: "#f4ecde",
  surfaceInset: "#efe4d3",
  paperRaised: "#fffdf7",
  ink: "#1f1c17",
  mutedInk: "#5f5a51",
  line: "#ddd5c8",
  lineStrong: "#bfb3a4",
  commitGreen: "#166534",
  distanceCoral: "#b42318",
  secondaryOrange: "#f97316",
  rankBlue: "#0b5cad",
  warmHighlight: "#f6c85f",
} as const;

export const brandTypography = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
} as const;

export const promptMark = {
  label: "Pace and Push prompt mark",
  character: ">",
} as const;

export const cssVariables = `:root {
  --paper: ${brandColors.paper};
  --surface-bright: ${brandColors.surfaceBright};
  --surface-panel: ${brandColors.surfacePanel};
  --surface-panel-high: ${brandColors.surfacePanelHigh};
  --surface-inset: ${brandColors.surfaceInset};
  --paper-2: ${brandColors.surfaceBright};
  --ink: ${brandColors.ink};
  --muted: ${brandColors.mutedInk};
  --line: ${brandColors.line};
  --line-strong: ${brandColors.lineStrong};
  --green: ${brandColors.commitGreen};
  --coral: ${brandColors.distanceCoral};
  --orange: ${brandColors.secondaryOrange};
  --blue: ${brandColors.rankBlue};
  --yellow: ${brandColors.warmHighlight};
}`;
