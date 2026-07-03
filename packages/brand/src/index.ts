export const brandName = "Pace & Push";

export const brandTagline = "Healthy body, shipped code.";

export const brandColors = {
  paper: "#f7f3ea",
  paperRaised: "#fffaf0",
  ink: "#1f1c17",
  mutedInk: "#746f64",
  line: "#d8d0c2",
  lineStrong: "#b9ad9d",
  commitGreen: "#2f9e44",
  distanceCoral: "#f15a3a",
  rankBlue: "#3277b8",
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
  --paper-2: ${brandColors.paperRaised};
  --ink: ${brandColors.ink};
  --muted: ${brandColors.mutedInk};
  --line: ${brandColors.line};
  --line-strong: ${brandColors.lineStrong};
  --green: ${brandColors.commitGreen};
  --coral: ${brandColors.distanceCoral};
  --blue: ${brandColors.rankBlue};
  --yellow: ${brandColors.warmHighlight};
}`;
