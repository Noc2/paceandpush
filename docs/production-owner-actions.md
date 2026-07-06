# Production Owner Actions

These items need owner input, provider access, legal details, or platform-account decisions before public production launch.

## Required Before Public Launch

1. Fill the legal identity fields in `apps/web/src/lib/legal.ts`.
   - Geschaeftsfuehrer
   - Registergericht
   - Registernummer / HRB
   - working legal/privacy email
   - VAT ID or Wirtschafts-ID decision
   - final § 36 VSBG wording

2. Choose and enable abuse protection.
   - Recommended: Vercel WAF / Firewall rules for public APIs and `/api/mobile/*` auth endpoints.
   - Alternative: provision Upstash Redis and add rate-limit env vars for middleware.
   - Cover at least search, leaderboard, SVG embed, GitHub refresh, pairing-code creation, and mobile auth exchange routes.

3. Enable production monitoring and alerting.
   - Enable Vercel Cron failure notifications for `/api/jobs/recompute-scores`.
   - Choose Sentry or Vercel Error Monitoring and provide the project DSN/integration.
   - Add an external uptime check against `https://paceandpush.com/api/health`.

4. Decide the Android launch scope.
   - Option A: descope Android from the first launch and update app-store/checklist copy accordingly.
   - Option B: finish real Android API sync, Health Connect upload, encrypted token storage, and backup exclusion before release.

5. Complete platform health-data compliance.
   - Apple: App Store privacy nutrition labels, HealthKit purpose strings, TestFlight/App Review material.
   - Google Play, if Android ships: Health Connect declaration, permission rationale, privacy policy URL, restricted-permission approval.

6. Confirm mobile OAuth hardening direction.
   - Prefer Android App Links and iOS Universal Links over custom schemes for production.
   - Register both GitHub OAuth callbacks:
     - `https://paceandpush.com/api/github/oauth/callback`
     - `https://paceandpush.com/api/github/oauth/callback/mobile`
   - Plan PKCE binding for the native OAuth exchange before broad mobile distribution.

7. Choose the distance day timezone policy.
   - Current native code can shift evening workouts across UTC day/month boundaries.
   - Pick device-local or UTC bucketing, then align iOS, Android, and API contract wording.

8. Provision production and staging data operations.
   - Create a staging/preview database or Neon branch separate from production.
   - Enable production backup/PITR.
   - Run and document one restore drill before public launch.
   - Run `npm run db:migrate` with production database credentials before deploying app traffic.

9. Set production secrets in Vercel.
   - `NEXT_PUBLIC_APP_URL=https://paceandpush.com`
   - `DATABASE_URL` or `POSTGRES_URL`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_TOKEN_ENCRYPTION_KEY`
   - `GITHUB_TOKEN_ENCRYPTION_KEY_ID=default`
   - `SESSION_SECRET`
   - `MOBILE_TOKEN_SECRET` distinct from `SESSION_SECRET`
   - `CRON_SECRET`

10. Get a final privacy/legal review.
    - Confirm processor list and international transfer safeguards for Vercel, Neon, GitHub, and any monitoring provider.
    - Confirm final retention periods for account, GitHub, mobile-device, score, and sync-run data.
