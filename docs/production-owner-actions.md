# Production Owner Actions

These items need owner input, provider access, legal details, or platform-account decisions before public production launch.

## Required Before Public Launch

1. Choose and enable abuse protection.
   - Application-level limits are process-local safeguards only; they are not a
     durable production rate limiter across Vercel instances.
   - Configure Vercel WAF / Firewall rules for `/`, `/users/*`, public APIs, and
     `/api/mobile/*` auth endpoints. Cover at least search, leaderboard, public
     profiles, SVG embeds, GitHub refresh, pairing-code creation, mobile auth
     exchange, and distance uploads.
   - Start the rules in log-only mode for 24–48 hours, review false positives,
     then enforce them. Keep `/api/jobs/recompute-scores` outside public traffic
     rules because it is authenticated with `CRON_SECRET`.
   - Record the active rules, thresholds, activation date, and owner in the
     release record.

2. Enable production monitoring and alerting.
   - Enable Vercel Cron failure notifications for `/api/jobs/recompute-scores`.
   - Choose Sentry or Vercel Error Monitoring and provide the project DSN/integration.
   - Add an external uptime check against `https://paceandpush.com/api/health`.
     This endpoint checks web liveness without waking Neon.
   - Use `https://paceandpush.com/api/ready` with
     `Authorization: Bearer $CRON_SECRET` only during releases and incidents to
     verify database connectivity and the required migration level. Do not poll
     it continuously.
   - Review Neon compute usage daily during beta and treat 25%, 50%, and 75% of
     the monthly allowance as investigation, warning, and release-stop gates.
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
   - Protect a GitHub environment named `production`, add its `DATABASE_URL`
     secret, and require an owner approval.
   - Apply migrations with the `Migrate production database` workflow using the
     exact reviewed release commit SHA. Its concurrency lock prevents parallel
     production migration runs.
   - Use expand/contract, backward-compatible migrations. Apply migrations
     before promoting code that requires them.
   - Keep the Vercel build command (`npm run vercel:build`). It validates
     migration files but deliberately does not connect to production, so a
     database outage cannot block a frontend recovery deployment.

8. Set production secrets in Vercel.
   - `NEXT_PUBLIC_APP_URL=https://paceandpush.com`
   - `NEXT_PUBLIC_IOS_APP_URL=https://testflight.apple.com/join/Pvzcf61w`
   - `NEXT_PUBLIC_ANDROID_APP_URL`
   - `DATABASE_URL` or `POSTGRES_URL`
   - `PUBLIC_VISIBILITY_KV_REST_API_URL`
   - `PUBLIC_VISIBILITY_KV_REST_API_TOKEN`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_TOKEN_ENCRYPTION_KEY`
   - `GITHUB_TOKEN_ENCRYPTION_KEY_ID=default`
   - `SESSION_SECRET`
   - `MOBILE_TOKEN_SECRET` distinct from `SESSION_SECRET`
   - `CRON_SECRET`
   - Provision a single-primary Upstash Redis database for the public-read
     projection, choose the closest appropriate EU region, enable TLS, and use
     primary/read-your-writes reads rather than a potentially stale replica.
   - Complete and retain Upstash's applicable data-processing and
     international-transfer terms before enabling the integration.
   - Confirm that missing or unavailable Redis credentials make public
     leaderboard, search, profile, and embed requests fail closed; they must
     never fall back to Neon.
   - After the August quota reset and database migrations, rebuild the public
     projections before reopening public discovery:
     `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://paceandpush.com/api/jobs/rebuild-public-projections`.

9. Keep privacy/legal records current.
   - `apps/web/src/lib/legal.ts` has production legal fields and is enforced by
     `npm run legal:check`.
   - Confirm the live privacy policy still matches enabled processors
     (including Upstash when the public projection is enabled),
     platform recipients, retention behavior, and store declarations before
     each public release.
