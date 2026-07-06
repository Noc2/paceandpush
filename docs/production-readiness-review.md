# Production Readiness Review

Date: 2026-07-06. Scope: full repo (`apps/web`, `apps/ios`, `apps/android`, `packages/*`, docs, CI, Vercel config) reviewed by four parallel passes: security, code quality & testing, UX & product, deployment readiness — plus external research.

Build health at review time: `npm test` 6/6 pass, `npm run typecheck` clean, `npm run lint` clean (but lint is just `tsc --noEmit`, see M13).

Note on scope: this repository contains **no smart contracts** — it is a Next.js web app with iOS/Android companions. Authorship verified: all 73 commits are by David Hawig <davidhawig@gmail.com>; the GitHub remote (`Noc2/paceandpush`) belongs to the same account (github.com/Noc2, user #24638510).

---

## Launch blockers (fix before production)

### B1. `MOBILE_TOKEN_SECRET` silently falls back to a hardcoded string in production
`apps/web/src/server/mobile/tokens.ts:205-211` — `MOBILE_TOKEN_SECRET || SESSION_SECRET || "paceandpush-local-dev-mobile-secret"`. Unlike `session.ts:72-78` (which throws in production), this never fails closed. Pairing codes are verified purely by HMAC with this secret and `POST /api/mobile/devices` is unauthenticated — if both env vars are ever unset in prod, anyone can forge a pairing code for any `githubId` and mint a 365-day device token (account takeover). **Fix:** throw in production when unset; prefer a dedicated secret distinct from `SESSION_SECRET` (key separation).

### B2. Account deletion 500s for mobile-OAuth users (GDPR endpoint broken)
`apps/web/src/server/data/accounts.ts:263-272` — `deleteAccountData` never deletes `mobile_auth_exchanges`, whose `user_id` FK references `users.id` (migration 0003). Any user who ever signed in via native mobile OAuth has rows there, so the final `DELETE FROM users` violates the FK and `/api/me/delete` fails. **Fix:** delete `mobileAuthExchanges` rows first; wrap deletion in a transaction (see B6) or use `ON DELETE CASCADE`. Add a test.

### B3. Unauthenticated full-cohort recompute = DoS/cost amplification
`read-model.ts:52-60` and `200-206` — any leaderboard/profile/embed request for a period without a snapshot triggers `recomputeScoreSnapshots(period)`: full cohort read + 3 boards × N users upserts (one HTTP round-trip each on neon-http). `parsePeriod` accepts any year/month/ISO-week, so an anonymous client can loop over thousands of periods. Concurrent recomputes for the same period also race (independent upserts, no lock). **Fix:** restrict on-demand recompute to current/recent periods, add a per-period in-progress guard (advisory lock), batch snapshot writes into one multi-row upsert per board.

### B4. No rate limiting or abuse protection anywhere
No `middleware.ts`, no 429s. Exposed: `/api/search/users` (`LIKE '%q%'` over a join), `/api/leaderboard` (N+1, see B5), the SVG embed, `POST /api/me/github/refresh` (~27 GitHub GraphQL calls + 3 recomputes per call, unthrottled), and `/api/mobile/*` auth endpoints (pairing-code brute force). **Fix:** Vercel WAF rules or `@upstash/ratelimit` in middleware on public + mobile-auth routes; debounce `me/github/refresh` (e.g. min 5 min).

### B5. Leaderboard N+1: ~2 extra queries per row
`read-model.ts:169-184` — `toLeaderboardRows` calls `getStreakDays` per row (2 queries each). 100 public users ≈ 200 DB HTTP round-trips per anonymous homepage request, uncached. **Fix:** compute streaks in one grouped query, or persist `streakDays` on the snapshot at recompute time (it changes daily anyway). Add `s-maxage=300, stale-while-revalidate` to `/api/leaderboard` and `/api/search/users`.

### B6. No transactions; destructive multi-step writes are non-atomic
The `neon-http` driver (`db/client.ts`) doesn't support transactions and none are attempted. `refreshGitHubCommitsForUser` (`scores.ts:83-114`) does DELETE-then-INSERT: a failure between them silently wipes a user's commit history for the period. Same class of risk in `deleteAccountData` and `disconnectGitHubAccount`. **Fix:** switch to `drizzle-orm/neon-serverless` (WebSocket `Pool`) for real transactions, or restructure the refresh as upsert + delete-stale in single statements.

### B7. Migrations are applied by hand with no tracking
No `drizzle-kit`, no `migrate()` call, no migration step in CI or Vercel build — the checklist says to run the six SQL files manually. No journal table, no drift detection; `0005` and `0006` are not idempotent (no `IF NOT EXISTS`); no down migrations. Also note `0001` defaults `public_leaderboard` to `false` while `schema.ts` says `true` (patched by 0004 — correct only if 0004 actually ran). **Fix:** adopt `drizzle-kit migrate` in a deploy step; add `IF NOT EXISTS` to 0005/0006; add `drizzle-kit check` to CI.

### B8. Android app is a non-functional mock
`apps/android/.../MainActivity.kt:53-83` — profile, leaderboard, and history are hardcoded literals; `HealthConnectDistanceSync.kt` is never instantiated; nothing uploads distance days or sync runs; the device token from pairing is stored but unused — and stored in plaintext `SharedPreferences` with `android:allowBackup="true"` (token included in cloud backups; iOS correctly uses Keychain). The launch checklist's Android release gate is currently unsatisfiable. **Fix:** either wire Android to the real API + Health Connect (with `EncryptedSharedPreferences`/backup exclusion) or explicitly descope Android from launch and update `docs/launch-checklist.md`.

### B9. Legal placeholders render on public pages
`apps/web/src/lib/legal.ts` — `/impressum` publicly shows "To be added before public launch" for Geschäftsführer, Registergericht, Registernummer, and email; `/privacy` lacks a privacy contact. Missing § 5 DDG mandatory fields on a German Impressum are an Abmahnung risk from day one. **Fix:** fill `legal.ts`; consider failing the production build if any field still contains the placeholder.

### B10. GDPR rights are documented but not operable from the UI
`settings/page.tsx:97-99` renders "Data export" and "Delete account" as inert text (`/api/me/privacy-export`, `DELETE /api/me/delete`). The privacy page tells consumers to issue a DELETE request — not a reasonable modality under GDPR Art. 12. **Fix:** real export link and a confirm-guarded delete button in Settings (which also depends on B2).

---

## High

- **H1. No security headers.** `next.config.ts` has none, no middleware: missing CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`. For the SVG embed route add `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` + `nosniff`.
- **H2. No logout and no session revocation.** Stateless HMAC cookie, 30-day TTL, no rotation; the only path clearing it is account deletion. Add `POST /api/auth/signout` and a per-user `sessionVersion` check so sessions can be invalidated.
- **H3. Cron job returns 200 even on total failure, no `maxDuration`, no alerting.** `api/jobs/recompute-scores/route.ts` returns `{ ok: false }` with HTTP 200 and has no try/catch; Vercel cron monitoring sees success. Sequential per-user GitHub fetches + per-row upserts will exceed default function timeouts at a few dozen users. Return 5xx on failure, set `export const maxDuration` (Pro allows up to 800s with fluid compute; consider splitting the workload — see research notes), use `timingSafeEqual` for the secret comparison.
- **H4. Effectively no observability.** Seven `console.error` sites total; no error tracking, no `/api/health`, no structured logging, several swallowed errors degrade silently (`read-model.ts:58, 204, 371`). Minimum: Sentry (or Vercel error monitoring), a health endpoint doing `SELECT 1`, cron failure alerting (healthchecks.io-style ping or Vercel cron notifications).
- **H5. Pairing codes are stateless and multi-use for their 10-min TTL.** `tokens.ts:100-114` verifies HMAC + expiry only — no single-use consumption (unlike the mobile-auth exchange codes, which do this correctly). Anyone who glimpses the QR can register their own device on the victim's account, repeatedly, with no notification. Persist a hash and consume atomically on first use; consider 2–5 min TTL.
- **H6. Mobile OAuth deep-link flow lacks PKCE binding.** `mobile/start` accepts an arbitrary `callbackScheme`; the exchange code is redeemable by whoever presents it. On Android, custom schemes can be claimed by malicious apps. Implement PKCE (verifier presented at `/api/mobile/auth/exchange`); prefer App Links on Android.
- **H7. Missing indexes for the hottest queries.** `score_snapshots` has no `(period, board, rank)` index (leaderboard is a full scan); `sync_runs` has no index at all but is queried `WHERE user_id ORDER BY started_at DESC` on every `/api/me`; range scans on `commit_days.day`/`distance_days.day` are unindexed.
- **H8. Zero tests for core product logic.** Nothing covers `score.ts` (the scoring math), `periods.ts` (ISO-week edge cases), session/mobile token sign/verify, `upsertDistanceDays`, `deleteAccountData` (would have caught B2), streaks, or any API route. All pure and easy to test with the existing `node --test` setup.

---

## Medium

- **M1.** `POST /api/mobile/distance-days` recomputes month snapshots only — week/year boards stay stale until cron; and a recompute failure 500s after data was already saved. Recompute all three periods; return 200 with a warning on post-upsert failure. (`distance-days/route.ts:38`)
- **M2.** `upsertDistanceDays` conflicts on `(user_id, day)` but the table also has a unique `(user_id, source_hash)` index — a colliding hash in a batch raises an unhandled 500. Android's weak hash (`healthconnect-android-running-$date-${meters.toLong()}`) makes this plausible. (`mobile.ts:227-251`)
- **M3.** Timezone policy mismatch: both apps bucket workouts by UTC date while querying by local midnight — a 7 pm run in San Francisco lands on the next day and can shift periods at month boundaries. Pick device-local bucketing, document it in `api-contracts`, align both apps. (`HealthKitDistanceSync.swift:46-47,124`; `HealthConnectDistanceSync.kt:53`)
- **M4.** GitHub GraphQL: no retry/backoff, no rate-limit handling; a transient 502 marks a user failed for the whole day; revoked tokens silently freeze a user's data with no `needsReconnect` surfaced from cron. Add 2–3 retries with backoff; persist per-account refresh status. (`contributions.ts`)
- **M5.** GitHub login recycling breaks sign-in: upsert targets `github_id` but `users_login_idx` is unique — a recycled username 500s the new user's first sign-in. Also `getPublicProfile` matches `lower(login)` which the case-sensitive index can't serve. (`accounts.ts:47-65`)
- **M6.** No boot-time env validation — missing secrets surface as runtime 500s, not failed deploys. Add an `env.ts` assertion (production-gated). `POSTGRES_URL` is read but undocumented in `.env.example`.
- **M7.** No caching on JSON APIs or pages despite once-daily data; the embed SVG route is the only one with correct cache headers.
- **M8.** Brand palette has drifted into three variants (web CSS vs `packages/brand` vs iOS/Android — e.g. blue `#3277b8` vs `#0f62fe`); `brand.cssVariables` and `native.ts` exist but nothing consumes them. Pick one palette, inject `cssVariables` into the web layout, codegen or delete `native.ts`.
- **M9.** Web a11y/UX: leaderboard uses `role="table"`/`role="row"` without `role="cell"` (broken for screen readers); no `<h1>` on the homepage; no `error.tsx`/`not-found.tsx`/`loading.tsx` anywhere; no homepage pointer to the companion apps (a checklist requirement — new users see distance stuck at 0.0 with no cue).
- **M10.** iOS: HealthKit read-denial is invisible (Apple hides it) — after a first sync with 0 workouts, show a "check Health sharing settings" hint. `signOut()` doesn't clear the health-authorized flag. Editable "API base URL" field is exposed to end users on both platforms — hide behind a debug flag.
- **M11.** Embed SVG: long logins/display names (up to 39 chars) collide with the metrics block — truncate with ellipsis server-side. Consider a `?theme=dark` param.
- **M12.** OpenAPI spec is paths-only: no request/response schemas attached (the JSON Schemas in `src/schemas.ts` are referenced by nothing), several paths missing, error responses undocumented, and the contract test only asserts path existence.
- **M13.** CI gaps: `lint` duplicates `typecheck` (no ESLint config exists); no Android `assembleDebug`/iOS build; no migration check; Node unpinned in `package.json` while CI pins 24.
- **M14.** Ops gaps: no staging/preview DB isolation documented, no backup/PITR verification or restore drill, `docs/launch/` directory is empty. Privacy export returns internal fields (`tokenHash`, `sourceMetadata`) — select explicit columns.
- **M15.** Checklist drift: `docs/launch-checklist.md` requires Android device sync (impossible today, see B8) and a homepage companion-app listing (unmet); missing items for alerting, backups, rate limiting, security headers, `maxDuration`, and registering the *mobile* OAuth callback URL alongside the web one.

---

## Low (selected)

- Cron secret compared with `!==` — use `timingSafeEqual`. `appUrl` falls back to the Host-header-derived origin; treat `NEXT_PUBLIC_APP_URL` as required and consider a `__Host-` cookie prefix.
- One HMAC key signs pairing codes, exchange state, device tokens (and, on fallback, sessions); the type prefix isn't covered by the signature. Include purpose in the HMAC input or use distinct keys.
- `token-crypto.ts` stores a key ID but ignores it on decrypt — key rotation would brick stored tokens. Support a keyring. (The crypto itself is solid: AES-256-GCM, fresh random IV, auth tag verified.)
- `sync-runs` route: `errorSummary: null` throws (only `undefined` is handled); `Date.parse(undefined)` rejects omitted `finishedAt`. `mobileAuthExchanges` rows are never purged. `getLeaderboard` has no row limit. Kilometers are rounded to 0.1 km before scoring (rank can flip on 50 m) — round only for display.
- `npm audit --omit=dev`: 2 moderate transitive findings (build-time postcss via Next); Next 16.2.10/React 19.2.4 current. Add audit to CI.
- Copy: "after … the score job runs" (internal jargon on homepage), "in the PoC" shown to end users in the Android rationale screen, embed markdown hardcodes `https://paceandpush.com`, `design-notes.md` links to a mockup file not in the repo.

---

## What's already good

Token handling is genuinely strong: AES-256-GCM GitHub token encryption, SHA-256-hashed device tokens with DB-backed instant revocation, single-use atomically-consumed mobile exchange codes, `timingSafeEqual` on HMAC comparisons, iOS Keychain with `AfterFirstUnlockThisDeviceOnly`, minimal OAuth scope, and no secrets ever committed (history checked). Web OAuth state handling is correct; every authenticated route scopes by the session/device user (no IDOR found); all SQL is parameterized with LIKE-escaping and a matching trigram index; SVG output is XML-escaped throughout. TypeScript is strict with zero `any`/non-null assertions in `apps/web/src`. iOS onboarding is a model flow, web empty/error states and ARIA effort are above average for a PoC, and CI gates PRs on typecheck + tests + build.

---

## External research notes

- **Vercel crons/functions:** cron duration limits equal function limits; with fluid compute, Pro allows up to 800 s `maxDuration` (1800 s in beta); Vercel recommends splitting long jobs or using Workflows for unbounded work, and a `CRON_SECRET` of ≥16 random chars (already done). Sources: [Vercel cron usage & pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [configuring function duration](https://vercel.com/docs/functions/configuring-functions/duration), [cron jobs docs](https://vercel.com/docs/cron-jobs).
- **Platform compliance (verify against current docs before submission — search tooling was intermittently unavailable during this review):** Apple App Review 5.1.3 requires a privacy policy for HealthKit apps, bans storing health data in iCloud and any advertising/data-mining use, and requires `NSHealthShareUsageDescription`. Google Play treats Health Connect permissions as restricted: expect a Play Console health apps declaration and approval before release, plus a compliant privacy policy. The privacy page's "daily totals only, no raw workouts" posture is a good fit for both.
- **GDPR:** Art. 12 requires facilitating data-subject rights — see B2/B10. The Impressum requirements referenced are § 5 DDG (Germany).

---

## Suggested order of attack

1. B1 (one-line fail-closed fix) and B2 (deletion FK) — small, worst impact.
2. B3 + B4 + B5 together (recompute bounds, rate limiting, streak precompute + caching) — they share the same code paths.
3. B6 + B7 (neon-serverless driver + drizzle-kit migrations) — unlocks transactions and safe deploys.
4. H1–H4 (headers, logout, cron status/alerting, Sentry + health endpoint).
5. B9 + B10 (legal fields, settings export/delete buttons) — required before the domain is public.
6. Decide B8: descope Android (update checklist) or finish it.
7. H5–H8 and the mediums as follow-ups; add tests alongside each fix.
