#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const preferredName = process.env.IOS_SIMULATOR_NAME?.trim();
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
  const hint = preferredName ? ` named ${preferredName}` : "";
  throw new Error(`Could not find an available iOS simulator${hint}.`);
}

console.log(selected.device.udid);

function compareRuntimeVersion(left, right) {
  const leftVersion = runtimeVersion(left);
  const rightVersion = runtimeVersion(right);

  if (leftVersion.major !== rightVersion.major) {
    return leftVersion.major - rightVersion.major;
  }

  return leftVersion.minor - rightVersion.minor;
}

function runtimeVersion(runtime) {
  const match = runtime.match(/iOS[- .](\d+)(?:[- .](\d+))?/);

  return {
    major: match ? Number(match[1]) : 0,
    minor: match?.[2] ? Number(match[2]) : 0,
  };
}

function isAvailable(device) {
  if (device.isAvailable === false) return false;
  return !String(device.availability ?? "").toLowerCase().includes("unavailable");
}
