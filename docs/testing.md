# Testing

Pace & Push currently has web/API checks plus native iOS XCTest coverage. The
iOS tests are designed to keep the simulator path deterministic while the native
app is still changing quickly.

## Web and API

Run the existing web checks from the repository root:

```sh
npm ci
npm run db:migrations:check
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` runs the Node test suites in `apps/web/test` and
`packages/api-contracts/test`.

## iOS

The iOS test targets live in `apps/ios/PacePushTests` and
`apps/ios/PacePushUITests`. They use the shared `PacePush` scheme.

Run the full simulator suite:

```sh
xcodebuild \
  -project apps/ios/PacePush.xcodeproj \
  -scheme PacePush \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
  -derivedDataPath .build/ios \
  -resultBundlePath .build/ios/PacePushTests.xcresult \
  test \
  CODE_SIGNING_ALLOWED=NO
```

If a local shell cannot access CoreSimulator but you still want a compile check,
use the generic simulator build:

```sh
xcodebuild \
  -project apps/ios/PacePush.xcodeproj \
  -scheme PacePush \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build/ios \
  build-for-testing \
  CODE_SIGNING_ALLOWED=NO
```

The UI tests use DEBUG-only launch arguments:

- `-uiTesting` starts the onboarding flow with fake dependencies and no network.
- `-uiTestingSeeded` starts with a fake connected, synced account.

HealthKit authorization and real workout reads still require a physical iPhone
with HealthKit capability enabled. Treat the simulator suite as coverage for
parsing, API request handling, onboarding state, and UI smoke paths; keep one
real-device HealthKit sync in the release gate.
