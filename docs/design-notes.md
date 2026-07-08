# Pace & Push Design Notes

The visual direction should feel like a useful developer tool first: sparse,
fast, direct, and slightly hand-built. The website should open on the actual
leaderboard experience, not a marketing landing page.

## Principles

- Make the leaderboard the first screen.
- Keep the web as public discovery: leaderboard, search, profiles, and app downloads.
- Use the native apps as the primary participation, sync, and settings surface.
- Keep health data consent explicit and visible.
- Use plain, sharp UI surfaces with subtle hand-drawn chart details.
- Treat the mobile apps as full clients, not just sync utilities.

## Identity

- Name: Pace & Push.
- Tagline: Run. Commit. Repeat.
- Mark: a simple terminal prompt built around `>`, paired with a route/cursor
  line and small metric pixels.
- Identity direction: quiet, technical, and direct, with the symbol doing the
  work without character art.
- Use route details only as surrounding UI decoration, not behind the logo mark.
- Avoid GitHub or Strava-derived marks in the product logo.

## Palette

- Paper: `#fbf7ef`
- Bright surface: `#fffdf7` for QR/code mats and rare low-emphasis raised details.
- Panel surface: `#f8f2e8`
- High panel surface: `#f4ecde`
- Inset surface: `#efe4d3`
- Ink: `#1f1c17`
- Muted ink: `#5f5a51`
- Line: `#ddd5c8`
- Commit green: `#2f9e44`
- Distance coral: `#f15a3a`
- Rank blue: `#3277b8`
- Warm highlight: `#f6c85f`

The palette intentionally mixes green, coral, blue, and warm yellow so the app
does not collapse into a single-hue fitness or developer theme.

Use the warm surface scale to show hierarchy without making child panels
brighter than their parents. The scale should remain light overall: child
surfaces may step darker, but they should not feel muddy or heavyweight. Avoid
cards inside cards when a row, divider, or unframed section will do; when nested
surfaces are necessary, move inward from paper to panel, high panel, then inset.

## Typography

- Product UI: system sans-serif for native feel and fast rendering.
- Metrics and GitHub handles: system monospace.
- Avoid oversized hero typography inside dashboards and phone screens.

## Shared Navigation

### Web

- Header: brand plus iPhone and Android download actions.
- Main view: public leaderboard with period picker, sorting, and search.
- Secondary view: public profile chart, GitHub embed, and app-download actions.
- Keep `/settings` available as a direct account fallback, but do not make it a
  primary public navigation item.

### Mobile

- Bottom tabs:
  - Today
  - Board
  - Profile
  - Sync
  - Settings

## Initial Mockups

Open [design-mockups.html](design-mockups.html) in a browser. It includes:

- Desktop leaderboard
- Desktop profile
- iOS Today screen
- iOS leaderboard screen
- Android sync screen
- Android profile screen
