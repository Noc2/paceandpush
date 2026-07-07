# Release Runbook

Use this runbook for every public web release, TestFlight build, App Store
submission, and Google Play internal test build.

## Contacts

- Release owner: David Hawig
- Support and privacy contact: hawigxyz@proton.me
- App Review support contact: hawigxyz@proton.me

## Preflight

Run these checks from the repository root before a release candidate is tagged
or submitted:

```sh
npm ci
npm run db:migrations:check
npm run legal:check
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
xcodebuild -project apps/ios/PacePush.xcodeproj -scheme PacePush -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath .build/ios -resultBundlePath .build/ios/PacePushTests.xcresult test CODE_SIGNING_ALLOWED=NO
```

Before store review, also complete
`docs/launch/real-device-beta-checklist.md` and attach the completed evidence
file to the release notes.

## Production Alerts

Configure these outside the repo before the app enters store review:

- Vercel Cron failure notifications for `/api/jobs/recompute-scores`.
- An external uptime check against `https://paceandpush.com/api/health`.
- Vercel runtime error notifications or Sentry. If Sentry or another
  error-monitoring provider is enabled, update `/privacy`, App Store privacy
  labels, Google Play Data safety, and `docs/production-owner-actions.md`
  before submitting.
- CI notifications for failed `main` builds, failed migration checks, and failed
  release archives.

Do not add analytics, advertising, or error-monitoring SDKs to native clients
until the privacy policy and store declarations are updated.

## Web Release

1. Confirm `main` is green in GitHub Actions.
2. Confirm Vercel production variables match `docs/launch-checklist.md`.
3. Deploy through the connected Vercel project.
4. Verify `https://paceandpush.com/api/health` returns `ok`.
5. Verify sign-in, settings, privacy export, account deletion, mobile pairing,
   leaderboard, and one public profile.
6. Record the Vercel deployment URL, commit SHA, and verification notes in the
   release note.

Rollback path:

1. Promote the last known-good Vercel deployment.
2. If the deployment included a schema migration, confirm whether the previous
   app version can read the new schema before rollback.
3. If rollback is blocked by data shape, deploy a forward fix instead of
   restoring an old binary.
4. Record the incident, affected endpoints, and follow-up migration plan.

## iOS Archive And TestFlight

Signing requirements:

- Bundle identifier: `com.paceandpush.app`
- Capability: HealthKit enabled.
- Privacy manifest: `apps/ios/PrivacyInfo.xcprivacy` included in the
  `PacePush` target.
- Review notes: paste `docs/launch/app-review-notes-ios.md` into App Store
  Connect.

Local unsigned archive evidence command:

```sh
xcodebuild -project apps/ios/PacePush.xcodeproj \
  -scheme PacePush \
  -configuration Release \
  -destination generic/platform=iOS \
  -derivedDataPath .build/app-review/DerivedData \
  -archivePath .build/app-review/PacePush.xcarchive \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=
```

Final signed submission:

1. Increment the Xcode build number.
2. Archive with signing enabled in Xcode.
3. Generate the Xcode privacy report from Organizer and save it beside
   `docs/launch/ios-privacy-report-2026-07-07.md`.
4. Upload to TestFlight.
5. Record the uploaded version, build number, archive date, privacy-report file,
   and tester group in the release note.

## Android Internal Testing

Android remains internal-testing only until the real API, Health Connect
permission/upload flow, launcher assets, and a repeatable Gradle build path are
verified.

Release requirements before Play internal testing:

- Health Connect permissions match the manifest, in-app rationale, privacy
  policy, and Play Console declaration.
- Production builds pin `https://paceandpush.com`.
- Signing keys and keystore passwords are stored outside the repository.
- At least one physical Android device has completed pairing, permission grant,
  sync upload, sync-run reporting, token revocation, and app data backup/restore
  checks.

When a Gradle wrapper or pinned Gradle toolchain is added, use this command for
release candidate verification:

```sh
./gradlew :app:assembleDebug :app:bundleRelease
```

Record the exact command output, versionCode, versionName, signing mode, and
Play track in the release note.

## Incident Procedures

Pause mobile sync:

1. Ask affected users to revoke connected devices from Settings.
2. For a single account, revoke the affected device through the web Settings UI
   or `DELETE /api/mobile/devices/:id/revoke`.
3. For a widespread mobile-auth issue, disable new native distribution links by
   clearing `NEXT_PUBLIC_IOS_APP_URL` and `NEXT_PUBLIC_ANDROID_APP_URL`, then
   deploy a server-side fix.
4. Keep `/api/health`, account deletion, and privacy export available whenever
   possible.

Compromised token or account:

1. Revoke the mobile device or disconnect GitHub from Settings.
2. Rotate the affected provider secret if the compromise involves application
   credentials.
3. Rotate `MOBILE_TOKEN_SECRET`, `SESSION_SECRET`, or
   `GITHUB_TOKEN_ENCRYPTION_KEY` only with a migration/invalidations plan,
   because rotation can invalidate active sessions or encrypted tokens.
4. Review audit/export metadata and document affected users.

Cron or score refresh failure:

1. Check the Vercel Cron event and `/api/jobs/recompute-scores` logs.
2. Verify `CRON_SECRET` and database connectivity.
3. Trigger a manual recompute only after confirming the failing condition is
   resolved.
4. If GitHub API quota is the cause, pause manual refresh messaging and wait for
   quota recovery.

Privacy or legal issue:

1. Pause the affected data flow.
2. Update `/privacy`, store labels, and app review notes before resuming.
3. Keep records of the policy version, release version, and change date.
