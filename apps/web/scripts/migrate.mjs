import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const migrationsDir = new URL("../drizzle/", import.meta.url);
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL is required to run migrations.");
}

const sql = neon(databaseUrl);
const migrationFiles = await listMigrationFiles();

await sql.query(`
  CREATE TABLE IF NOT EXISTS paceandpush_schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

const appliedRows = await sql.query(
  "SELECT name, checksum FROM paceandpush_schema_migrations",
);
const applied = new Map(appliedRows.map((row) => [row.name, row.checksum]));

for (const fileName of migrationFiles) {
  const migrationSql = await readFile(new URL(fileName, migrationsDir), "utf8");
  const statements = splitSqlStatements(migrationSql);
  const checksum = createHash("sha256").update(migrationSql).digest("hex");
  const appliedChecksum = applied.get(fileName);

  if (appliedChecksum) {
    if (appliedChecksum !== checksum) {
      throw new Error(`Migration ${fileName} has changed since it was applied.`);
    }
    console.log(`Already applied ${fileName}`);
    continue;
  }

  await sql.transaction((txn) => [
    ...statements.map((statement) => txn.query(statement)),
    txn.query(
      "INSERT INTO paceandpush_schema_migrations (name, checksum) VALUES ($1, $2)",
      [fileName, checksum],
    ),
  ]);
  console.log(`Applied ${fileName}`);
}

async function listMigrationFiles() {
  const files = await readdir(fileURLToPath(migrationsDir));
  return files
    .filter((fileName) => /^\d{4}_.+\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));
}

function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let dollarQuote = null;
  let inBlockComment = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inSingleQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inLineComment) {
      if (character === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (character === "*" && nextCharacter === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (dollarQuote) {
      if (source.startsWith(dollarQuote, index)) {
        index += dollarQuote.length - 1;
        dollarQuote = null;
      }
      continue;
    }

    if (inSingleQuote) {
      if (character === "'" && nextCharacter === "'") {
        index += 1;
      } else if (character === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (character === "\"") inDoubleQuote = false;
      continue;
    }

    if (character === "-" && nextCharacter === "-") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (character === "'") {
      inSingleQuote = true;
      continue;
    }

    if (character === "\"") {
      inDoubleQuote = true;
      continue;
    }

    if (character === "$") {
      const dollarQuoteMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(
        source.slice(index),
      );
      if (dollarQuoteMatch) {
        dollarQuote = dollarQuoteMatch[0];
        index += dollarQuote.length - 1;
        continue;
      }
    }

    if (character === ";") {
      const statement = source.slice(start, index).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }

  const finalStatement = source.slice(start).trim();
  if (finalStatement) statements.push(finalStatement);
  return statements;
}
