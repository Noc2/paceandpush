# Launch Checklist

Pace & Push PoC launch target: Vercel-hosted web app at `paceandpush.com`,
with native iOS and Android companion app betas.

Owner-only production setup is tracked in
`docs/production-owner-actions.md`.

## Vercel

- Create a Vercel project from this repository with the repository root as the
  project root.
- Set the build command to `npm run build` and the install command to `npm ci`.
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

- Run `npm run db:migrations:check`, then run `npm run db:migrate` with
  production `DATABASE_URL` before deploying application traffic.
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
- `npm run build`

## Native Apps

- Apple Developer: create the iOS app record, enable HealthKit, add privacy
  nutrition labels, and distribute the first build through TestFlight.
- Google Play Console: create the Android app record, declare Health Connect
  running exercise and distance access, provide the permission rationale and
  privacy policy, and distribute the first build through internal testing.
- Point both apps at `https://paceandpush.com` before beta distribution.

## Legal

- Confirm `/impressum` and `/privacy` are linked from every public page footer.
- Add the Geschäftsführer, register court, HRB number, and working legal email
  to `apps/web/src/lib/legal.ts`.
- Confirm whether a VAT ID or Wirtschafts-ID must be listed.
- Confirm employee count and consumer dispute resolution wording for § 36 VSBG.
- Confirm processor agreements, international transfer safeguards, and final
  retention periods for Vercel, Neon, GitHub, and any future analytics/email
  provider.
- Have the Impressum and privacy policy reviewed before public launch.

## Release Gate

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- iOS build in Xcode with HealthKit capability enabled.
- Android build in Android Studio with Health Connect SDK resolved.
- Manual GitHub OAuth login.
- Manual mobile pairing exchange.
- Manual running distance sync with one iOS and one Android test device.
