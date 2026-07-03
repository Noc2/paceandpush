# Pace & Push Design Notes

The visual direction should feel like a useful developer tool first: sparse,
fast, direct, and slightly hand-built. The website should open on the actual
leaderboard experience, not a marketing landing page.

## Principles

- Make the leaderboard the first screen.
- Use the same information architecture on web, iOS, and Android.
- Keep health data consent explicit and visible.
- Use plain, sharp UI surfaces with subtle hand-drawn chart details.
- Treat the mobile apps as full clients, not just sync utilities.

## Identity

- Name: Pace & Push.
- Tagline: Healthy body, shipped code.
- Mark: an original running dino crossing a route line shaped like a terminal
  prompt.
- Mascot direction: playful, small, and pixel-adjacent without copying the
  Chrome offline dinosaur or the referenced GitHub profile GIF.
- Avoid GitHub or Strava-derived marks in the product logo.
- The referenced `saadeghi/saadeghi` `dino.gif` is a good mood reference, but
  the source repository does not show an obvious license. Do not bundle or ship
  that GIF directly unless permission or license terms are confirmed.

## Palette

- Paper: `#f7f3ea`
- Ink: `#1f1c17`
- Muted ink: `#746f64`
- Line: `#d8d0c2`
- Commit green: `#2f9e44`
- Distance coral: `#f15a3a`
- Rank blue: `#3277b8`
- Warm highlight: `#f6c85f`

The palette intentionally mixes green, coral, blue, and warm yellow so the app
does not collapse into a single-hue fitness or developer theme.

## Typography

- Product UI: system sans-serif for native feel and fast rendering.
- Metrics and GitHub handles: system monospace.
- Avoid oversized hero typography inside dashboards and phone screens.

## Shared Navigation

### Web

- Header: brand, period picker, GitHub connect/account button.
- Main view: leaderboard with board tabs.
- Secondary view: profile chart and recent sync details.

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
