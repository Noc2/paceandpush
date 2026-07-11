import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { contractVersion, jsonSchemas } from "../src/schemas.ts";
import { publicHealthDataConsentVersion } from "../src/types.ts";

const api = JSON.parse(
  await readFile(new URL("../openapi/paceandpush.v1.json", import.meta.url), "utf8"),
);

test("OpenAPI lists the production route surface", () => {
  for (const path of [
    "/api/me",
    "/api/me/settings",
    "/api/me/github/refresh",
    "/api/me/github/disconnect",
    "/api/me/privacy-export",
    "/api/me/delete",
    "/api/leaderboard",
    "/api/search/users",
    "/api/users/{login}",
    "/api/mobile/pairing-codes",
    "/api/mobile/auth/github/start",
    "/api/github/oauth/callback/mobile",
    "/api/mobile/auth/exchange",
    "/api/mobile/me",
    "/api/mobile/me/github/disconnect",
    "/api/mobile/me/privacy-export",
    "/api/mobile/me/delete",
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

test("OpenAPI version tracks the shared contract version", () => {
  assert.equal(api.info.version, contractVersion);
});

test("OpenAPI documents period selection for mobile profile history", () => {
  const parameters = api.paths["/api/mobile/me/profile"].get.parameters ?? [];
  assert.ok(
    parameters.some((parameter) => parameter.name === "period" && parameter.in === "query"),
    "mobile profile supports period query parameter",
  );
});

test("OpenAPI documents mobile request bodies and bearer auth", () => {
  for (const [path, method, schemaName] of [
    ["/api/mobile/auth/exchange", "post", "MobileAuthExchangeRequest"],
    ["/api/mobile/devices", "post", "DeviceExchangeRequest"],
    ["/api/mobile/me/settings", "patch", "AccountSettingsPatch"],
    ["/api/mobile/distance-days", "post", "DistanceDaysRequest"],
    ["/api/mobile/sync-runs", "post", "SyncRunRequest"],
  ]) {
    assert.equal(
      api.paths[path][method].requestBody.content["application/json"].schema.$ref,
      `#/components/schemas/${schemaName}`,
    );
  }

  for (const [path, method] of [
    ["/api/mobile/me", "get"],
    ["/api/mobile/me/github/disconnect", "delete"],
    ["/api/mobile/me/privacy-export", "get"],
    ["/api/mobile/me/delete", "delete"],
    ["/api/mobile/me/settings", "patch"],
    ["/api/mobile/me/profile", "get"],
    ["/api/mobile/distance-days", "post"],
    ["/api/mobile/sync-runs", "post"],
  ]) {
    assert.deepEqual(api.paths[path][method].security, [{ mobileBearer: [] }]);
  }
  assert.equal(api.components.securitySchemes.mobileBearer.scheme, "bearer");
  assert.ok(
    api.components.schemas.MobileAuthExchangeRequest.required.includes("codeVerifier"),
    "mobile auth exchanges require a PKCE code verifier",
  );
  assert.ok(
    api.paths["/api/mobile/auth/github/start"].get.parameters.some(
      (parameter) => parameter.name === "codeChallenge" && parameter.required,
    ),
    "mobile auth start requires a PKCE code challenge",
  );
  assert.equal(
    api.components.schemas.MobileAuthExchangeRequest.properties.publicLeaderboard.type,
    "boolean",
  );
  assert.equal(
    api.components.schemas.DeviceExchangeRequest.properties.publicLeaderboard.type,
    "boolean",
  );
  assert.ok(
    api.components.schemas.DeviceExchangeResponse.required.includes("publicLeaderboard"),
  );
  assert.equal(
    api.components.schemas.PublicHealthDataConsentRequest.properties.version.const,
    publicHealthDataConsentVersion,
  );
  assert.equal(
    api.components.schemas.PublicHealthDataConsentRequest.properties.publishExactPeriodKilometers.const,
    true,
  );
  assert.equal(
    api.components.schemas.PublicHealthDataConsentRequest.properties.publicActivityHistory.type,
    "boolean",
  );
  assert.equal(
    api.components.schemas.AccountSettingsPatch.properties.publicHealthDataConsent.$ref,
    "#/components/schemas/PublicHealthDataConsentRequest",
  );
  for (const schemaName of ["MobileAuthExchangeRequest", "DeviceExchangeRequest"]) {
    assert.equal(
      api.components.schemas[schemaName].properties.publicHealthDataConsent.$ref,
      "#/components/schemas/PublicHealthDataConsentRequest",
    );
  }
  for (const field of [
    "publicActivityHistory",
    "publicHealthDataConsentVersion",
    "publicHealthDataConsentedAt",
  ]) {
    assert.ok(api.components.schemas.DeviceExchangeResponse.required.includes(field));
  }
  for (const path of ["/api/mobile/auth/exchange", "/api/mobile/devices"]) {
    assert.equal(
      api.paths[path].post.responses["200"].content["application/json"].schema.$ref,
      "#/components/schemas/DeviceExchangeResponse",
    );
  }
});

test("distance-day schemas include server-enforced limits", () => {
  assert.equal(jsonSchemas.distanceDayInput.properties.meters.maximum, 250000);
  assert.match(jsonSchemas.distanceDayInput.properties.date.description, /UTC calendar day/);
  assert.match(jsonSchemas.distanceDayInput.properties.meters.description, /UTC day/);
  assert.match(jsonSchemas.distanceDayInput.properties.meters.description, /over 100000/);
  assert.equal(jsonSchemas.distanceDaysRequest.properties.days.maxItems, 45);
  assert.match(api.components.schemas.DistanceDayInput.properties.date.description, /UTC calendar day/);
  assert.equal(api.components.schemas.DistanceDayInput.properties.meters.maximum, 250000);
  assert.equal(api.components.schemas.DistanceDaysRequest.properties.days.maxItems, 45);
});

test("contract README documents UTC distance-day bucketing", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.match(readme, /UTC calendar dates/);
  assert.match(readme, /\/api\/mobile\/distance-days/);
});
