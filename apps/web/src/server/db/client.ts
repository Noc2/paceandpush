import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let db: DbClient | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getDb(): DbClient {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required to initialize the database client");
  }

  if (!db) {
    db = drizzle(neon(databaseUrl), { schema });
  }

  return db;
}

function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}
