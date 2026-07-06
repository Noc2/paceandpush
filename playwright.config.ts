import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const storeUrls = {
  android: "https://example.com/pace-push-android-beta",
  ios: "https://example.com/pace-push-ios-beta",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run dev -w @paceandpush/web -- --hostname 127.0.0.1 --port ${port}`,
        env: {
          DATABASE_URL: "",
          NEXT_PUBLIC_ANDROID_APP_URL: storeUrls.android,
          NEXT_PUBLIC_IOS_APP_URL: storeUrls.ios,
          NEXT_TELEMETRY_DISABLED: "1",
          POSTGRES_URL: "",
        },
        gracefulShutdown: {
          signal: "SIGTERM",
          timeout: 500,
        },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      },
  projects: [
    {
      name: "ios-mobile-web",
      use: {
        ...devices["iPhone 16"],
      },
    },
  ],
});
