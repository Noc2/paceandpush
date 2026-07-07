import { readFile } from "node:fs/promises";

const legalPath = new URL("../apps/web/src/lib/legal.ts", import.meta.url);
const source = await readFile(legalPath, "utf8");

const forbiddenPlaceholders = [
  /to be added/i,
  /to be confirmed/i,
  /before public launch/i,
  /consumer-facing launch/i,
  /\bTBD\b/i,
  /\bTODO\b/i,
  /placeholder/i,
];

const requiredLegalValues = [
  "Hawig Ventures UG (haftungsbeschränkt)",
  "David Hawig",
  "Amtsgericht Bad Kreuznach",
  "HRB 24975",
  "hawigxyz@proton.me",
];

const placeholderMatches = forbiddenPlaceholders
  .filter((pattern) => pattern.test(source))
  .map((pattern) => pattern.source);
const missingValues = requiredLegalValues.filter((value) => !source.includes(value));

if (placeholderMatches.length > 0 || missingValues.length > 0) {
  console.error("Legal production check failed.");

  if (placeholderMatches.length > 0) {
    console.error("Found placeholder-like text in apps/web/src/lib/legal.ts:");
    for (const pattern of placeholderMatches) {
      console.error(`- ${pattern}`);
    }
  }

  if (missingValues.length > 0) {
    console.error("Missing required legal values:");
    for (const value of missingValues) {
      console.error(`- ${value}`);
    }
  }

  process.exit(1);
}

console.log("Checked legal production fields.");
