# Design improvement ideas

Findings from a review of the web app, iOS app, and Android app UI code. Ordered by impact.

## 1. Brand lockup (logo + "Pace & Push" + tagline) repeats on every page

The full lockup renders on three web pages (`/`, `/users/[login]`, `/settings` — all via the same `topbar` markup), on the iOS Board, Profile, and Onboarding screens (`HeaderView` in `PacePushApp.swift`), and on all three Android tabs (`header()` in `MainActivity.kt`).

Worse, the tagline can appear **twice on the same screen**:

- iOS Profile: `HeaderView` shows it, and the profile bio fallback repeats brand copy.
- Android Profile: `header()` shows it, and `profileScreen()` (line 317) hardcodes it again.

**Recommendation:**

- Web: full lockup (logo + name + tagline) on the home page only. Inner pages get a compact version — logo mark + "Pace & Push", no tagline. Extract the header into a shared `SiteHeader` component with a `compact` prop; it's currently copy-pasted in three files.
- iOS: drop `HeaderView` from Board and Profile — they're inside a `NavigationStack` and the tab bar already labels them. Keep the lockup on Onboarding only (it's the "front door"). Use `.navigationTitle("Leaderboard")` for the Board like Profile already does.
- iOS/Android: never use the brand tagline as a bio fallback. Use something personal-feeling instead ("No bio yet — add one on GitHub.") or just omit the line.
- Android: keep the header on the Board tab only, or shrink it to logo + name on Profile/Settings.

## 2. Header spacing is too tight

Current values:

- Web `.brand-lockup` has `gap: 14px` between the 34px logo mark and a 28px wordmark — the mark visually crowds the text. The tagline sits only 4px under the name.
- Web `.top-actions` buttons are `gap: 10px` apart and only 24px (topbar gap) from the lockup; on narrow screens the topbar stacks vertically with no added breathing room.
- Android: logo box (52dp) has only `12dp` right margin; tab bar buttons have `4dp` between them.

**Recommendation:**

- Web: bump `.brand-lockup` gap to 16–18px, `.top-actions` gap to 12–14px, and give `.topbar` more vertical padding (e.g. `padding: 8px 0 32px`). If the download buttons become icons at some point, give each a ≥44px tap target with ≥12px gaps.
- Android: raise tab button margin to 8dp (and drop the margin on the last one so the row stays optically centered), and give the logo 16dp right margin.
- iOS `HeaderView` (if kept anywhere): `spacing: 12` → 16.

## 3. Replace the tagline

The previous tagline reads as two disconnected fragments and is long for persistent chrome. Candidates that keep the dev-culture voice and the `>` prompt mark:

- **"Run. Commit. Repeat."** — rhythmic, mirrors dev loops, short enough for the header.
- **"Miles and merges."** — alliterative, very compact.
- **"Ship code. Log miles."** — parallel structure, action-first.
- **"Commits by day, kilometers by dawn."** — more evocative; better for marketing copy than chrome.
- **"The leaderboard for runners who ship."** — descriptive; good for the meta description and App Store copy rather than the header.

Whatever you pick, it lives in one place (`packages/brand/src/index.ts` -> `brandTagline`), but note the Android app and the iOS bio fallback hardcode the string — those should import/mirror the brand constant or be removed (see §1). Also update `layout.tsx`'s meta description to match.

Suggested placement after the change: home page hero, onboarding, store listings, README — not the recurring header.

## 4. Smaller ideas

- **Top-3 emphasis on the leaderboard.** Ranks 01–03 could get the warm highlight (`--yellow`) or bolded rank numerals; right now every row is visually identical.
- **Highlight the signed-in user's row** on web and mobile boards so people can find themselves without searching.
- **Web inner-page navigation is inconsistent.** Profile pages show the download buttons; Settings shows a "Leaderboard" button. Pick one pattern for inner pages (e.g. compact lockup + back-to-board link) and reserve download CTAs for home.
- **Sticky leaderboard header** on web: with long boards the column labels scroll away; `position: sticky` on `.leaderboard-head` is cheap.
- **Android tab bar looks like three loose buttons.** Give the row a shared 1px ink border with internal dividers like the iOS `BoardSelector`, so it reads as one segmented control.
- **Empty chart placeholder (iOS)** and the web empty state are good — mirror that quality on Android, which currently just prints a text line.
- **Settings "Server" section (iOS)** exposes the raw API base URL to all users; hide it behind a debug flag or bury it under an "Advanced" disclosure so the Settings screen stays consumer-friendly.
