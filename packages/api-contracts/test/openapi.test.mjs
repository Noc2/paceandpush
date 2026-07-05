import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const api = JSON.parse(
  await readFile(new URL("../openapi/paceandpush.v1.json", import.meta.url), "utf8"),
);

test("OpenAPI lists the production route surface", () => {
  for (const path of [
    "/api/me",
    "/api/me/settings",
    "/api/me/privacy-export",
    "/api/me/delete",
    "/api/leaderboard",
    "/api/users/{login}",
    "/api/mobile/pairing-codes",
    "/api/mobile/auth/github/start",
    "/api/github/oauth/callback/mobile",
    "/api/mobile/auth/exchange",
    "/api/mobile/me",
    "/api/mobile/me/settings",
    "/api/mobile/me/profile",
    "/api/mobile/devices",
    "/api/mobile/devices/{id}/revoke",
    "/api/mobile/distance-days",
    "/api/mobile/sync-runs",
    "/api/jobs/recompute-scores",
  ]) {
    assert.ok(api.paths[path], `${path} is documented`);
  }
});
