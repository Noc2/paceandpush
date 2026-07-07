# Pre-Publish Improvement Research

Date: 2026-07-07

Scope: committed `main` at `4104fce` plus repository docs and app-store policy
research. This memo focuses on improvements that should happen before a public
mobile app release. `docs/production-readiness-review.md` remains useful
history, but several items from that review have already been partially or
fully addressed in current code.

## Executive take

Do not publish both native apps publicly as-is. The strongest launch path is:

1. Ship the web app and iOS companion through a controlled TestFlight beta after
   clearing the privacy, legal, abuse-control, and real-device QA items below.
2. Keep Android on internal testing until it is wired to the real API and Health
   Connect runtime permission flow.
3. Treat Apple and Google health-data declarations as product work, not just
   store forms. The app's current daily-total-only posture is good, but the
   disclosures, review notes, and in-app wording must exactly match it.

## Implementation Status

Status after the pre-publish implementation pass on July 7, 2026:

- P0 items 1-4 and 6 are implemented in-repo: legal fields and placeholder
  checks, production privacy commitments, iOS privacy manifest/archive evidence,
  GitHub-specific App Review notes, visible disconnect/revocation paths, mobile
  OAuth PKCE/scheme hardening, rate limits, refresh throttling, and recompute
  coalescing.
- Android is no longer shell-only for internal testing: it loads the real mobile
  profile and public leaderboard APIs, requests Health Connect permissions,
  uploads foreground daily distance totals, records sync runs, stores bearer
  credentials encrypted, exposes disconnect/revocation, and has adaptive
  launcher icons plus a GitHub Actions `assembleDebug` job.
- P1/P2 repo work is represented by launch runbooks, store-listing drafts,
  screenshot and real-device evidence checklists, production-pinned native
  settings, UTC date-bucketing documentation, beta feedback links, zero-distance
  repair hints, and shareable profile paths.
- Remaining blockers are external or physical-device gates: enable production
  alert recipients in Vercel/Sentry or Vercel Error Monitoring, export the final
  Xcode Organizer privacy report PDF, complete real-device iPhone and Android
  checklists, capture final store screenshots, upload signed TestFlight/Play
  builds, complete App Store and Play Console privacy/health declarations, and
  confirm the new Android CI job is green on `main`.

## External research anchors

- Apple says App Review expects the app to be tested for crashes and bugs,
  metadata to be complete and accurate, review access to be provided, and backend
  services to be live during review:
  https://developer.apple.com/app-store/review/guidelines/
- Apple requires privacy-policy access in App Store metadata and inside the app,
  clear data uses, retention/deletion policies, consent revocation, data
  minimization, and account deletion for apps with account creation:
  https://developer.apple.com/app-store/review/guidelines/
- Apple treats HealthKit and health/fitness data as especially sensitive. The
  guidelines ban advertising, marketing, and use-based data mining uses of
  HealthKit-derived data, require disclosure of the specific health data
  collected, and prohibit storing personal health information in iCloud:
  https://developer.apple.com/app-store/review/guidelines/
- Apple privacy labels are required for new apps and updates, and must include
  data collected by the app plus third-party partners:
  https://developer.apple.com/app-store/app-privacy-details/
- Apple requires approved reasons for listed APIs in privacy manifests for new
  or updated App Store Connect uploads, and Xcode combines manifests into a
  privacy report:
  https://developer.apple.com/news/?id=3d8a9yyh and
  https://developer.apple.com/support/third-party-SDK-requirements/
- Apple's Login Services rule can require an equivalent privacy-preserving login
  option when a third-party/social login creates the primary account, unless the
  app qualifies as a client for a specific third-party service:
  https://developer.apple.com/app-store/review/guidelines/
- Google Play requires a Data safety form, a privacy policy, review of declared
  permissions/APIs, and disclosure of third-party library/SDK data handling:
  https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play Health permissions require a comprehensive privacy policy,
  accurate health-data disclosures, encryption at rest and in transit, access
  controls, secure development practices, and a declared approved use case:
  https://support.google.com/googleplay/android-developer/answer/12991134
- Android Health Connect requires manifest permissions matching Play Console
  declarations and an in-app privacy-policy/rationale activity for the Health
  Connect permissions screen:
  https://developer.android.com/health-and-fitness/health-connect/get-started
- OWASP MASVS is a good pre-release mobile security checklist for storage,
  network, auth, platform interaction, code quality, and privacy:
  https://mas.owasp.org/MASVS/

## Current strengths

- The web app now has security headers, a health endpoint, production migration
  tracking, cached leaderboard/search responses, and a production-gated
  `MOBILE_TOKEN_SECRET`.
- Account export, account deletion, sign-out, GitHub disconnect, leaderboard
  visibility, and unit controls exist in Settings.
- GitHub token handling is still a strength: encrypted token storage, token hash
  metadata, minimal OAuth scope, retry/backoff for GitHub contribution fetches,
  and server-side scoped reads.
- iOS has the stronger native path: HealthKit entitlement and purpose strings,
  Keychain device-token storage, mobile GitHub auth, HealthKit foreground sync,
  XCTest/XCUITest wiring, and CI coverage.
- The privacy policy already says the product uploads daily aggregate distance
  totals rather than raw workouts, GPS routes, or step-by-step samples. That
  posture maps well to Apple and Google health-data expectations.

## P0: clear before any public store submission

### 1. Finish legal and privacy-policy production details

Evidence:

- `apps/web/src/lib/legal.ts` still has placeholders for `email`, VAT if
  applicable, employee-count/VSBG status, and consumer-dispute wording.
- `apps/web/src/app/privacy/page.tsx` still says processor agreements,
  international transfer safeguards, final hosting locations, production
  security controls, incident-response contacts, and legal review must be
  confirmed before public launch.

Why it matters:

- Apple and Google both require a privacy policy that is live, accurate, and
  accessible. Google Health permissions explicitly call for retention/deletion
  policies and security practices. Apple requires privacy policy access in the
  app and App Store metadata.

Recommended work:

- Fill `legal.ts` with the working privacy/support email and final legal fields.
- Finalize processor agreements and transfer positions for Vercel, Neon, GitHub,
  Apple, Google, and any analytics/error-monitoring provider.
- Replace the privacy page's launch-warning language with final production
  commitments before store review.
- Add a production build check that fails if `legal.ts` contains placeholder
  strings.

### 2. Add iOS privacy manifest and generate the App Store privacy report

Evidence:

- No `PrivacyInfo.xcprivacy` file exists under `apps/ios`.
- `apps/ios/PacePushApp.swift` uses `UserDefaults` through the
  `PreferencesStoring` abstraction.

Why it matters:

- Apple requires approved reasons for listed APIs in privacy manifests for App
  Store Connect uploads. Even if the app has no third-party iOS SDKs today, the
  first archive should be checked with Xcode's privacy report and the app's own
  required-reason API usage should be declared if applicable.

Recommended work:

- Add `apps/ios/PrivacyInfo.xcprivacy` to the Xcode target.
- Declare collected data consistently with the privacy policy and App Store
  privacy label: GitHub identity, GitHub activity summaries, device/sync
  metadata, account settings, and daily aggregate fitness distance.
- Declare required-reason API usage found by Xcode, especially local preference
  storage if flagged.
- Archive once locally and save the generated privacy report for App Review
  evidence.

### 3. Resolve the Apple GitHub-only login review risk

Evidence:

- The iOS app creates the primary account through GitHub OAuth via
  `ASWebAuthenticationSession`.
- GitHub identity and contribution data are core to scoring, but the app still
  creates a Pace & Push account around that GitHub login.

Why it matters:

- Apple's Login Services rule can require another privacy-preserving login
  option when a third-party/social login creates the primary account. The likely
  argument for Pace & Push is that it is a client for the specific GitHub service
  and needs GitHub login to access the user's contribution data, but this should
  be explicit in App Review notes.

Recommended work:

- Decide one of two paths:
  - Treat the app as a GitHub-specific client and write App Review notes
    explaining that GitHub login is required to access the user's GitHub
    contribution content and build the product's score.
  - If the account can exist without GitHub in the future, add Sign in with
    Apple or first-party account setup before public submission.
- Keep the in-app GitHub disconnect path visible and tested, because Apple's
  privacy rules also require a mechanism to revoke social-network credentials
  and disable data access.

### 4. Harden mobile OAuth and deep links

Evidence:

- `/api/mobile/auth/github/start` accepts a `callbackScheme` query parameter and
  signs it in server state.
- `/api/github/oauth/callback/mobile` redirects to
  `${callbackScheme}://auth/callback` with a server-issued exchange code.
- There is no PKCE binding between the native app and the backend exchange, and
  Android uses a custom scheme rather than verified App Links.

Why it matters:

- Custom URL schemes can be claimed by another app, especially on Android. The
  current server state prevents arbitrary callback-scheme tampering after start,
  but it does not prove that the app redeeming the final exchange code is the
  same app that initiated the auth attempt.

Recommended work:

- Add PKCE-style verifier/challenge binding to the mobile auth start and
  exchange flow.
- Restrict mobile callback schemes to an allowlist by platform.
- Prefer Universal Links on iOS and verified App Links on Android for production
  auth callbacks, with custom scheme retained only as a fallback.
- Add tests that a stolen or mismatched exchange code cannot mint a device
  token.

### 5. Do not publish Android publicly until it is a real client

Evidence:

- `apps/android/README.md` says Android is pairing/shell-only.
- `HealthConnectDistanceSync.kt` can collect data, but `MainActivity.kt` still
  displays hardcoded leaderboard/profile/history values and does not request
  Health Connect runtime permissions or upload `/api/mobile/distance-days` and
  `/api/mobile/sync-runs`.
- `.github/workflows/ci.yml` has web and iOS jobs only.
- `apps/android/app/src/main/res` has no launcher icon or adaptive icon assets.

Why it matters:

- Google Play Health permission review expects the app listing, in-app
  disclosures, runtime permissions, and actual functionality to match. A shell
  app requesting Health Connect permissions is a review and user-trust risk.

Recommended work:

- Wire Android to `/api/mobile/me`, `/api/mobile/me/profile`,
  `/api/leaderboard`, `/api/mobile/distance-days`, and `/api/mobile/sync-runs`.
- Add Health Connect runtime permission request UX and clear denial/retry states.
- Add Android launcher/adaptive icon assets and at least one CI job for
  `assembleDebug`.
- Keep Android on internal testing until at least one real-device sync has been
  recorded end to end.

### 6. Add abuse controls around public and mobile-auth endpoints

Evidence:

- There is no app middleware or visible rate limiter.
- Public endpoints include leaderboard/search/profile/embed routes.
- Auth-sensitive routes include GitHub refresh, mobile pairing, mobile auth, and
  distance upload.
- On-demand snapshot recompute is now limited to current/previous periods, but
  concurrent recomputes can still duplicate backend work.

Why it matters:

- Store review requires live backend services. A small launch spike or a basic
  scripted abuse pattern should not be able to exhaust database/GitHub quota or
  make review accounts unreliable.

Recommended work:

- Add Vercel Firewall rules or application-level rate limiting for public JSON,
  mobile auth, pairing-code, GitHub refresh, and distance upload routes.
- Add a per-period recompute lock or in-progress guard.
- Add minimum refresh intervals for `POST /api/me/github/refresh`.
- Add structured 429 responses and tests for the highest-risk routes.

## P1: high-return improvements before open beta

### 7. Finish observability and launch alerts

Current state:

- `/api/health` exists and cron now returns 5xx on total failure.
- There is no Sentry or equivalent error tracking in the repo, and no documented
  alert route for cron, health, failed migrations, or store-review backend
  failures.

Recommended work:

- Add error tracking for server routes and native clients.
- Configure cron-failure and health-check alerting before the app is in review.
- Add a release runbook with who gets paged, how to pause mobile sync, how to
  revoke a compromised token, and how to roll back web deployments.

### 8. Add release automation and signed-build evidence

Evidence:

- There is no Fastlane setup, export options plist, Android signing config,
  release workflow, or app-store artifact folder.
- CI runs web checks and iOS tests, but not iOS archive or Android build.

Recommended work:

- Add a local or CI-documented iOS archive command with signing requirements,
  bundle id, HealthKit capability, version/build-number bumping, and TestFlight
  upload steps.
- Add an Android bundle build path with signing handled outside the repo.
- Track the exact command output and uploaded build number in a release note for
  each submission.

### 9. Create store assets and metadata from the real product

Evidence:

- iOS app icons exist.
- Android launcher/adaptive icon assets are missing.
- No store screenshots, app previews, feature graphics, review notes, or
  localized listing text are present in the repo.
- The web download modal already supports store/beta links through
  `NEXT_PUBLIC_IOS_APP_URL` and `NEXT_PUBLIC_ANDROID_APP_URL`, but those links
  are empty until owner setup.

Recommended work:

- Add `docs/store-listing/` with App Store and Play Store copy, privacy answers,
  review notes, screenshot checklist, and release contact details.
- Capture screenshots from real app states: onboarding, GitHub connected,
  Health permission, first sync, profile, leaderboard, settings/account deletion.
- Avoid claims that look medical, diagnostic, prize-based, or store-performance
  related.

### 10. Hide production-unsafe native settings

Evidence:

- iOS and Android expose an editable API base URL field in Settings.
- Localhost is allowed for pairing and testing flows.

Recommended work:

- Hide API-base editing behind a debug/TestFlight-only flag.
- Keep production builds pinned to `https://paceandpush.com`.
- Add a visible build/environment label only in non-production builds.

### 11. Decide and document date-bucketing semantics

Evidence:

- The native sync code buckets HealthKit and Health Connect workouts by UTC day,
  while users generally think in local training days.

Recommended work:

- Decide whether rankings are based on UTC or device-local dates.
- Document the choice in `packages/api-contracts` and privacy/store review notes.
- Add tests for workouts near midnight and month/week boundaries.

### 12. Run a real-device beta checklist before store review

Recommended coverage:

- iPhone: fresh install, GitHub auth, HealthKit grant, HealthKit denial,
  zero-workout account, first sync, resync, sign-out, GitHub disconnect, account
  export, account deletion, app reinstall.
- Android internal: Health Connect unavailable, permission denied, permission
  granted, no running sessions, one running session, token revocation, app data
  backup/restore behavior.
- Backend: store-review demo account, production health endpoint, cron success,
  GitHub token revoked, database migration dry run, Vercel rollback.

## P2: product polish that can move activation

- Add native public-profile navigation parity on Android after iOS. The web
  already opens profiles from leaderboard rows.
- Show a clearer first-run "why distance is zero" path and Health permission
  repair hints after zero-workout or denied-permission syncs.
- Add a shareable profile/card after first successful sync. This uses existing
  profile/embed work and gives beta testers a concrete reason to invite peers.
- Add a weekly recap email or push notification only after explicit opt-in and
  after the privacy policy/store declarations are updated for the new data flow.
- Add a "beta feedback" link from Settings so TestFlight and internal testers
  have one obvious support path.

## Suggested order of work

1. Legal/privacy finalization, iOS privacy manifest, and App Store privacy-label
   draft.
2. Mobile OAuth PKCE/deep-link hardening and rate limiting.
3. Real-device iOS TestFlight QA with store-review notes and screenshots.
4. Observability and release runbook.
5. Android real API plus Health Connect permission/upload flow.
6. Android CI/build/signing/assets, then Google Play internal/closed testing.

## Go/no-go recommendation

- Web production launch: close legal placeholders, rate limiting, alerting, and
  release-runbook gaps first.
- iOS TestFlight: reasonable after P0 items 1-4 and 6, plus real-device QA.
- iOS public App Store: wait until privacy manifest, privacy labels, review
  notes, screenshots, legal contact, and abuse controls are complete.
- Android public Google Play: no-go until Android is no longer shell-only and has
  Health Connect runtime permission, upload, sync-run reporting, CI build, and
  store assets.
