# Real-Device Beta Checklist

Complete this file for the exact build submitted to TestFlight or Google Play
internal testing. Save screenshots, logs, and notes outside the repo when they
contain account or health-derived data.

## Release Candidate

- Commit SHA:
- Web deployment URL:
- iOS version and build:
- Android versionCode and versionName:
- Tester account:
- Demo mode tested:
- Test date:
- Tester device and OS:

## iPhone

- Fresh install opens onboarding and links to `/privacy`.
- Try Demo opens Profile, Board, and Settings without GitHub, HealthKit, or
  network credentials, then Exit Demo returns to onboarding.
- GitHub auth succeeds with the production backend.
- GitHub-only login rationale is present in App Review notes.
- Apple Health grant path succeeds.
- Apple Health denial path shows recovery guidance.
- Zero-workout account explains why distance is zero.
- Before Apple Health authorization, the app explains aggregate upload, private
  first sync, and separate optional publication.
- First sync uploads daily aggregate running distance only and remains private.
- Publication preview names the no-account internet audience and exact public
  identity, distance, commit, score, rank, streak, bio, and sync-time fields.
- Keep Private completes setup without exposing leaderboard, search, or profile data.
- Publish Exact Totals exposes the summary only after server confirmation.
- Dated history is off by default, can be enabled separately, and disappears
  from anonymous profiles after it is disabled.
- Make Profile Private removes the user from anonymous discovery immediately;
  a simulated failure retains the prior visible state and offers retry.
- Resync is idempotent and updates sync status.
- Leaderboard, profile, settings, export, account deletion, and sign-out work.
- Sign-out remains visible and revokes GitHub server access.
- App reinstall does not restore health data or device credentials from iCloud.

## Android Internal

- Health Connect unavailable state is clear and does not request impossible
  permissions.
- Health Connect permission denial shows retry guidance.
- Health Connect grant path reads running sessions only.
- The pre-permission rationale explains private aggregate upload and separate
  optional public sharing.
- No-running-session state explains why distance is zero.
- One real running session syncs to `/api/mobile/distance-days`.
- Exact summary publication, dated-history opt-in, and one-tap withdrawal each
  match the authoritative server response.
- `/api/mobile/sync-runs` records success and failure states.
- Token revocation disables further mobile API access.
- App data backup/restore does not restore usable bearer credentials.
- Public release remains blocked until this section is complete on a physical
  device.

## Backend

- `https://paceandpush.com/api/health` returns `ok`.
- Cron recompute returns success for the production database.
- App Review can use Try Demo without a GitHub account.
- A real connected account can sign in, pair, disconnect, export, and delete.
- Revoked GitHub token path shows a recoverable reconnect state.
- Migration dry run is complete through `npm run db:migrations:check`.
- Vercel rollback target is identified and compatible with the current schema.

## Evidence

- Screenshots captured:
- Xcode archive/privacy report path:
- Android build artifact path:
- Vercel deployment:
- CI run:
- Notes:
