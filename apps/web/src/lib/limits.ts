import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

const num = (k: string, d: number) => {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? v : d;
};

export const LIMITS = {
  dailySessions: () => num("DAILY_SESSIONS_PER_IP", 20),
  dailyPremiumSessions: () => num("DAILY_PREMIUM_SESSIONS_PER_IP", 3),
  maxMessagesPerSession: () => num("MAX_MESSAGES_PER_SESSION", 40),
  maxVoiceSeconds: () => num("MAX_VOICE_SECONDS", 180),
  /** Blocked guard attempts from one IP within an hour before the IP is cooled down. */
  blockedAttemptsPerHour: () => num("BLOCKED_ATTEMPTS_PER_HOUR", 5),
};

const today = () => new Date().toISOString().slice(0, 10);

export class LimitError extends Error {
  status = 429;
}

/** Counts a new session against the IP's daily quota. Throws LimitError when exhausted. */
export async function consumeSession(ipHash: string, premium: boolean) {
  const db = await getDb();
  const date = today();
  await db
    .insert(schema.usageLimits)
    .values({ ipHash, date })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(schema.usageLimits)
    .where(and(eq(schema.usageLimits.ipHash, ipHash), eq(schema.usageLimits.date, date)));
  if (row.sessionCount >= LIMITS.dailySessions())
    throw new LimitError("Bugünkü deneme hakkınız doldu. Yarın tekrar deneyebilirsiniz.");
  if (premium && row.premiumSessionCount >= LIMITS.dailyPremiumSessions())
    throw new LimitError("Büyük modellerle bugünkü deneme hakkınız doldu. Standart bir model seçin.");
  await db
    .update(schema.usageLimits)
    .set({
      sessionCount: sql`${schema.usageLimits.sessionCount} + 1`,
      premiumSessionCount: premium ? sql`${schema.usageLimits.premiumSessionCount} + 1` : schema.usageLimits.premiumSessionCount,
    })
    .where(and(eq(schema.usageLimits.ipHash, ipHash), eq(schema.usageLimits.date, date)));
}

/** True when this IP has had too many blocked agent definitions in the last hour. */
export async function isIpCooledDown(ipHash: string) {
  const db = await getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.safetyEvents)
    .where(and(eq(schema.safetyEvents.ipHash, ipHash), eq(schema.safetyEvents.decision, "block"), gte(schema.safetyEvents.createdAt, since)));
  return count >= LIMITS.blockedAttemptsPerHour();
}
