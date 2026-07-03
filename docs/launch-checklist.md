# Launch Checklist

Pace & Push PoC launch target: Vercel-hosted web app at `paceandpush.com`,
with native iOS and Android companion app betas.

## Vercel

- Create a Vercel project from this repository with the repository root as the
  project root.
- Set the build command to `npm run build` and the install command to `npm ci`.
- Add `paceandpush.com` and `www.paceandpush.com` to the production deployment.
- Configure production environment variables:
  - `NEXT_PUBLIC_APP_URL=https://paceandpush.com`
  - `DATABASE_URL`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `SESSION_SECRET`
  - `MOBILE_TOKEN_SECRET`
  - `CRON_SECRET`
- Register the GitHub OAuth callback:
  `https://paceandpush.com/api/github/oauth/callback`.
- Confirm the daily Vercel Cron call to `/api/jobs/recompute-scores` returns
  200 with `Authorization: Bearer $CRON_SECRET`.

## Data

- Apply `apps/web/drizzle/0001_initial.sql` to the production database.
- Replace fixture-backed leaderboard reads with database-backed score snapshots.
- Backfill the first public month before inviting external testers.
- Keep mobile distance storage to daily totals for the PoC.

## Native Apps

- Apple Developer: create the iOS app record, enable HealthKit, add privacy
  nutrition labels, and distribute the first build through TestFlight.
- Google Play Console: create the Android app record, declare Health Connect
  distance access, provide the permission rationale and privacy policy, and
  distribute the first build through internal testing.
- Point both apps at `https://paceandpush.com` before beta distribution.

## Release Gate

- `npm run typecheck`
- `npm run build`
- iOS build in Xcode with HealthKit capability enabled.
- Android build in Android Studio with Health Connect SDK resolved.
- Manual GitHub OAuth login.
- Manual mobile pairing exchange.
- Manual distance sync with one iOS and one Android test device.
