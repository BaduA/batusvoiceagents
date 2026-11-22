import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

/** KVKK: deletes sessions (cascades to messages + action logs) and safety events older than RETENTION_DAYS. */
export async function cleanupOldData() {
  const days = Number(process.env.RETENTION_DAYS) || 7;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const db = await getDb();
  const s = await db.delete(schema.sessions).where(lt(schema.sessions.startedAt, cutoff)).returning({ id: schema.sessions.id });
  const e = await db.delete(schema.safetyEvents).where(lt(schema.safetyEvents.createdAt, cutoff)).returning({ id: schema.safetyEvents.id });
  await db.delete(schema.usageLimits).where(lt(schema.usageLimits.date, sql`${cutoff.toISOString().slice(0, 10)}`));
  return { sessions: s.length, safetyEvents: e.length, cutoff: cutoff.toISOString() };
}
