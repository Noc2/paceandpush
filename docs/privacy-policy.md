# Privacy Policy Notes

The public privacy policy now lives in the web app at
`apps/web/src/app/privacy/page.tsx` and is linked from the global footer at
`/privacy`.

## Current Coverage

- GitHub identity: GitHub id, username, display name, and avatar URL.
- GitHub activity summaries: daily commit counts and restricted/private
  contribution aggregates used for scoring.
- GitHub OAuth credentials: token hash plus encrypted access token for
  server-side score refresh.
- Distance summaries: daily running distance totals from HealthKit or Health
  Connect.
- Device sync metadata: platform, device label, sync status, and timestamps.
- Session cookies and OAuth state cookies.
- Public leaderboard/profile visibility settings.
- Data export and deletion controls.

## Data We Do Not Collect In The PoC

- Raw workouts.
- GPS routes.
- Step-by-step health samples.
- Private repository source code.
- Payment information.

## Open Legal Details

- Working privacy/legal email address.
- Processor agreements and international transfer safeguards for Vercel, Neon,
  GitHub, and any future analytics or email providers.
- Final retention periods for score snapshots, sync logs, and deleted accounts.
- Legal review of the HealthKit and Health Connect consent wording before beta
  distribution.
