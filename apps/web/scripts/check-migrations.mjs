import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationsDir = new URL("../drizzle/", import.meta.url);
const migrationFiles = (await readdir(fileURLToPath(migrationsDir)))
  .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
  .sort((left, right) => left.localeCompare(right));

if (migrationFiles.length === 0) {
  throw new Error("No SQL migration files found.");
}

for (const [index, fileName] of migrationFiles.entries()) {
  const expectedPrefix = `${String(index + 1).padStart(4, "0")}_`;
  if (!fileName.startsWith(expectedPrefix)) {
    throw new Error(`Migration ${fileName} should start with ${expectedPrefix}.`);
  }

  const source = await readFile(new URL(fileName, migrationsDir), "utf8");
  if (/CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(source)) {
    throw new Error(`${fileName} creates an index without IF NOT EXISTS.`);
  }
  if (/ADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS)/i.test(source)) {
    throw new Error(`${fileName} adds a column without IF NOT EXISTS.`);
  }
}

console.log(`Checked ${migrationFiles.length} migration files.`);
