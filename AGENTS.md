# AGENTS.md

## Scope

- This file is the root guidance for the Pace & Push repository. Add nested
  `AGENTS.md` files only when a subtree needs more specific rules.
- Pace & Push is a monorepo with a Next.js web/API app in `apps/web`, shared
  packages in `packages/*`, a SwiftUI iOS app in `apps/ios`, and a Kotlin
  Android app in `apps/android`.

## Working Agreements

- Inspect the relevant code, docs, scripts, and current git state before
  changing files. Do not overwrite user changes.
- Keep changes scoped to the requested behavior. Avoid unrelated refactors,
  formatting churn, generated artifacts, or dependency updates unless they are
  required for the task.
- Commit each completed change after verification unless the user explicitly
  asks not to commit. Keep independent fixes in separate commits.
- Do not push unless the user explicitly asks for a push.
- Use clear commit messages that describe the user-visible or operational
  change, for example `Add agent workflow guidance`.

## Commands

- Use Node 24 and npm 11, matching `package.json` and CI.
- Install dependencies with `npm ci`.
- Web/API checks from the repository root:
  - `npm run db:migrations:check`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`
- Run production dependency audit with `npm run audit:prod` when dependency or
  release-readiness work could affect production risk.
- Run mobile-web Playwright coverage with `npm run test:e2e`. Install WebKit
  first with `npx playwright install webkit` when the browser is missing.

## Native App Verification

- iOS tests use the shared `PacePush` scheme and the simulator selector:

  ```sh
  SIMULATOR_UDID="$(node scripts/select-ios-simulator.mjs)"
  xcodebuild \
    -project apps/ios/PacePush.xcodeproj \
    -scheme PacePush \
    -destination "platform=iOS Simulator,id=$SIMULATOR_UDID" \
    -derivedDataPath .build/ios \
    -resultBundlePath .build/ios/PacePushTests.xcresult \
    test \
    CODE_SIGNING_ALLOWED=NO
  ```

- If simulator services are unavailable but a compile check is still useful,
  run the generic simulator build described in `docs/testing.md`.
- Android CI assembles the debug app with Java 17, Android SDK 36, Gradle
  8.11.1, and:

  ```sh
  gradle -p apps/android :app:assembleDebug --no-daemon
  ```

## Product And Design Notes

- Keep web, iOS, and Android visuals aligned with shared brand tokens in
  `packages/brand` and the existing native color constants. Avoid one-off
  palette drift.
- HealthKit and Health Connect sync daily running-distance totals only. Do not
  upload raw workouts or routes.
- Treat simulator tests as coverage for parsing, API handling, onboarding, and
  UI smoke paths. Real HealthKit reads still require a physical iPhone.
- Keep Android on Google Play internal testing until the physical-device
  checklist in `docs/launch/real-device-beta-checklist.md` is complete and
  Android CI is green on `main`.

## Documentation And Release Notes

- Update docs when behavior, setup, launch, privacy, or testing expectations
  change. Relevant docs include `docs/testing.md`, `docs/launch-checklist.md`,
  `docs/launch/release-runbook.md`, and store-listing docs under
  `docs/store-listing/`.
- For publish-readiness work, start from existing launch/readiness docs and
  verify current Apple/Google policy or CI/toolchain details before repeating
  older findings.

## Security And Secrets

- Do not print, commit, or expose secrets from `.env.local`, Vercel, GitHub,
  Apple, Google, or signing materials.
- Prefer structured parsers and existing helper scripts over ad hoc text
  manipulation for migrations, OpenAPI/contracts, and generated artifacts.
- When adding or changing API routes, check payload validation, rate limiting,
  caching headers, and whether mobile and web clients both need updates.
