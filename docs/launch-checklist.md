# Launch Checklist

Pace & Push PoC launch target: Vercel-hosted web app at `paceandpush.com`,
with native iOS and Android companion app betas.

Owner-only production setup is tracked in
`docs/production-owner-actions.md`.

## Vercel

- Create a Vercel project from this repository with the repository root as the
  project root.
- Keep the build command from `vercel.json`: `npm run vercel:build`. It runs
  migration checks and production migrations before `npm run build`. Keep the
  install command as `npm ci`.
- Add `paceandpush.com` and `www.paceandpush.com` to the production deployment.
- Configure production environment variables:
  - `NEXT_PUBLIC_APP_URL=https://paceandpush.com`
  - `NEXT_PUBLIC_IOS_APP_URL`
  - `NEXT_PUBLIC_ANDROID_APP_URL`
  - `DATABASE_URL`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_TOKEN_ENCRYPTION_KEY`
  - `GITHUB_TOKEN_ENCRYPTION_KEY_ID=default`
  - `SESSION_SECRET`
  - `MOBILE_TOKEN_SECRET`
  - `CRON_SECRET`
- Register the GitHub OAuth callback:
  `https://paceandpush.com/api/github/oauth/callback`.
- Confirm the daily Vercel Cron call to `/api/jobs/recompute-scores` returns
  200 with `Authorization: Bearer $CRON_SECRET` and reports score snapshots.

## Data

- Run `npm run db:migrations:check` before launch. Vercel production builds run
  `npm run db:migrate` through `npm run vercel:build`; run `npm run db:migrate`
  manually only for non-Vercel deployment paths or explicit data-operation drills.
- Confirm leaderboard, profile, settings, privacy export, device revoke, sync
  run, and running distance upload routes read/write production database rows.
- Confirm the web homepage and public profiles show iPhone and Android download
  actions.
- Confirm each download action opens a QR modal with the configured store or
  beta link.
- Confirm a signed-in web user can generate a mobile pairing code from Settings.
- Backfill the first public month before inviting external testers, and ask
  existing accounts to reconnect GitHub after deploying encrypted token storage.
- Keep mobile running distance storage to daily totals for the PoC.
- Treat GitHub commit counts as GraphQL contribution-summary based, with
  restricted/private contribution aggregates counted only when visible to the
  signed-in user's GitHub token.

## CI

- GitHub Actions `CI` is green on `main`.
- `npm ci`
- `npm run db:migrations:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- iOS `xcodebuild test` for the `PacePush` scheme.

## Native Apps

- Apple Developer: create the iOS app record, enable HealthKit, add privacy
  nutrition labels, and distribute the first build through TestFlight.
- Confirm the iOS archive includes `PrivacyInfo.xcprivacy`, generate the Xcode
  privacy report from the organizer, and save the report with App Review
  evidence before submitting.
- Google Play Console: create the Android app record, declare Health Connect
  running exercise and distance access, provide the permission rationale and
  privacy policy, and distribute the first build through internal testing.
- Point both apps at `https://paceandpush.com` before beta distribution.

## Legal

- Confirm `/impressum` and `/privacy` are linked from every public page footer.
- Keep `apps/web/src/lib/legal.ts` current and run `npm run legal:check`.
- Confirm the current production processor/recipient position in `/privacy`
  still matches the enabled services: Vercel, Neon, GitHub, Apple, Google, and
  no analytics, advertising, or error-monitoring provider.
- Re-review the Impressum and privacy policy whenever a new processor,
  monitoring provider, analytics provider, paid plan, background sync, raw
  workout collection, or GPS route collection is added.

## Release Gate

- `npm run typecheck`
- `npm run lint`
- `npm run legal:check`
- `npm test`
- `npm run test:e2e`
- `npm run build`
- iOS XCTest/XCUITest suite passes for the `PacePush` scheme.
- Android build in Android Studio with Health Connect SDK resolved.
- Manual GitHub OAuth login.
- Manual mobile pairing exchange.
- Manual running distance sync with one iOS HealthKit device, plus one Android
  Health Connect device if Android is included in the launch scope.
