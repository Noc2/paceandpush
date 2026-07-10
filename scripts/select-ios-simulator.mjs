#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const preferredName = process.env.IOS_SIMULATOR_NAME?.trim();
const preferredRuntime = process.env.IOS_SIMULATOR_RUNTIME?.trim();
const requestedRuntime = preferredRuntime ? runtimeVersion(preferredRuntime) : null;
if (preferredRuntime && requestedRuntime.major === 0) {
  throw new Error(`Could not parse IOS_SIMULATOR_RUNTIME "${preferredRuntime}".`);
}
const maxSupportedRuntime = requestedRuntime ?? newestSupportedSimulatorRuntime();
const output = execFileSync("xcrun", [
  "simctl",
  "list",
  "devices",
  "available",
  "--json",
], {
  encoding: "utf8",
});
const inventory = JSON.parse(output);
const candidates = Object.entries(inventory.devices ?? {})
  .filter(([runtime]) => runtime.includes("iOS"))
  .filter(([runtime]) =>
    runtimeIsAllowed(runtime, maxSupportedRuntime, Boolean(requestedRuntime)),
  )
  .sort(([left], [right]) => compareRuntimeVersion(right, left))
  .flatMap(([runtime, devices]) =>
    devices
      .filter((device) => isAvailable(device) && device.name.startsWith("iPhone"))
      .map((device) => ({ device, runtime })),
  );

const selected = preferredName
  ? candidates.find(({ device }) => device.name === preferredName)
  : candidates[0];

if (!selected) {
  const nameHint = preferredName ? ` named ${preferredName}` : "";
  const runtimeHint = preferredRuntime
    ? ` on iOS ${preferredRuntime}`
    : maxSupportedRuntime
      ? ` at or below iOS ${maxSupportedRuntime.major}.${maxSupportedRuntime.minor}`
      : "";
  const hint = `${nameHint}${runtimeHint}`;
  throw new Error(`Could not find an available iOS simulator${hint}.`);
}

console.log(selected.device.udid);

function compareRuntimeVersion(left, right) {
  return compareVersions(runtimeVersion(left), runtimeVersion(right));
}

function compareVersions(left, right) {
  if (left.major !== right.major) return left.major - right.major;
  return left.minor - right.minor;
}

function runtimeVersion(runtime) {
  const match = runtime.match(/iOS[- .](\d+)(?:[- .](\d+))?/);

  return {
    major: match ? Number(match[1]) : 0,
    minor: match?.[2] ? Number(match[2]) : 0,
  };
}

function runtimeIsAllowed(runtime, selectedRuntime, exactMatch) {
  if (!selectedRuntime) return true;
  const version = runtimeVersion(runtime);
  if (version.major === 0) return false;
  if (exactMatch) {
    return version.major === selectedRuntime.major && version.minor === selectedRuntime.minor;
  }
  return compareVersions(version, selectedRuntime) <= 0;
}

function newestSupportedSimulatorRuntime() {
  try {
    const sdks = execFileSync("xcodebuild", ["-showsdks"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const versions = [...sdks.matchAll(/iphonesimulator(\d+)(?:\.(\d+))?/g)]
      .map((match) => ({
        major: Number(match[1]),
        minor: match[2] ? Number(match[2]) : 0,
      }))
      .sort(compareVersions);

    return versions.at(-1) ?? null;
  } catch {
    return null;
  }
}

function isAvailable(device) {
  if (device.isAvailable === false) return false;
  return !String(device.availability ?? "").toLowerCase().includes("unavailable");
}
