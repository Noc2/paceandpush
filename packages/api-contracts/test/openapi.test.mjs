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
    "/api/mobile/devices",
    "/api/mobile/devices/{id}/revoke",
    "/api/mobile/distance-days",
    "/api/mobile/sync-runs",
    "/api/jobs/recompute-scores",
  ]) {
    assert.ok(api.paths[path], `${path} is documented`);
  }
});
