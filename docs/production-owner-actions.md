# Production Owner Actions

These items need owner input, provider access, legal details, or platform-account decisions before public production launch.

## Required Before Public Launch

1. Choose and enable abuse protection.
   - Application-level rate limits now cover public and mobile-auth endpoints.
   - Recommended supplement: Vercel WAF / Firewall rules for public APIs and `/api/mobile/*` auth endpoints.
   - Cover at least search, leaderboard, SVG embed, GitHub refresh, pairing-code creation, mobile auth exchange, and distance upload routes.

2. Enable production monitoring and alerting.
   - Enable Vercel Cron failure notifications for `/api/jobs/recompute-scores`.
   - Choose Sentry or Vercel Error Monitoring and provide the project DSN/integration.
   - Add an external uptime check against `https://paceandpush.com/api/health`.
   - Keep `docs/launch/release-runbook.md` updated with the active alert
     recipients, rollback path, and incident contacts.

3. Decide the Android launch scope.
   - Current scope: Android can proceed to internal testing only.
   - Public Google Play remains blocked until Android CI is green on `main`,
     Play Console Health Connect review is complete, and the physical-device
     checklist proves pairing, permission, sync upload, sync-run reporting,
     token revocation, and backup/restore behavior.

4. Complete platform health-data compliance.
   - Apple: App Store privacy nutrition labels, HealthKit purpose strings, TestFlight/App Review material.
   - Google Play, if Android ships: Health Connect declaration, permission rationale, privacy policy URL, restricted-permission approval.
   - Use `docs/store-listing/` as the source draft for store copy, screenshot
     coverage, privacy declarations, and review answers.

5. Confirm mobile OAuth hardening direction.
   - Prefer Android App Links and iOS Universal Links over custom schemes for production.
   - Register both GitHub OAuth callbacks:
     - `https://paceandpush.com/api/github/oauth/callback`
     - `https://paceandpush.com/api/github/oauth/callback/mobile`
   - Native OAuth now uses PKCE binding and platform callback-scheme allowlists;
     verified Android App Links and iOS Universal Links are still preferred for
     later production auth callbacks.

6. Choose the distance day timezone policy.
   - Current product policy is UTC calendar-day bucketing.
   - Revisit this only with an API-contract, native-client, privacy-policy, and
     store-review update.

7. Provision production and staging data operations.
   - Create a staging/preview database or Neon branch separate from production.
   - Enable production backup/PITR.
   - Run and document one restore drill before public launch.
   - Confirm Vercel keeps the repository `buildCommand` (`npm run vercel:build`),
     which runs migration checks and production migrations before the app build.
     Run `npm run db:migrate` manually only for non-Vercel deploys or explicit
     data-operation drills.

8. Set production secrets in Vercel.
   - `NEXT_PUBLIC_APP_URL=https://paceandpush.com`
   - `NEXT_PUBLIC_IOS_APP_URL`
   - `NEXT_PUBLIC_ANDROID_APP_URL`
   - `DATABASE_URL` or `POSTGRES_URL`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_TOKEN_ENCRYPTION_KEY`
   - `GITHUB_TOKEN_ENCRYPTION_KEY_ID=default`
   - `SESSION_SECRET`
   - `MOBILE_TOKEN_SECRET` distinct from `SESSION_SECRET`
   - `CRON_SECRET`

9. Keep privacy/legal records current.
   - `apps/web/src/lib/legal.ts` has production legal fields and is enforced by
     `npm run legal:check`.
   - Confirm the live privacy policy still matches enabled processors,
     platform recipients, retention behavior, and store declarations before
     each public release.
