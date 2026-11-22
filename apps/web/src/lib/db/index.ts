import "server-only";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { DDL } from "./ddl";

export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __vapDb: Promise<DB> | undefined;
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { prepare: false, max: 5 });
    await client.unsafe(DDL);
    return drizzle(client, { schema });
  }
  // Local dev fallback: embedded Postgres (WASM) persisted to ./.data
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.exec(DDL);
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalThis.__vapDb ??= connect().catch((e) => {
    globalThis.__vapDb = undefined;
    throw e;
  });
  return globalThis.__vapDb;
}

export { schema };
