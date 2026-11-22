import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { agentConfigSchema, GuardUnavailableError, type AgentConfig } from "@vap/core";
import { getDb, schema } from "./db";
import { newId, newSlug } from "./ids";
import { canEditAgent, clientIpHash, editCookieName, hashToken, isAdmin, newToken } from "./security";
import { guardConfig, logSafetyEvent } from "./safety";
import { isIpCooledDown } from "./limits";

export type AgentRow = typeof schema.agents.$inferSelect;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function publicAgent(a: AgentRow, editable: boolean) {
  return {
    id: a.id,
    name: a.name,
    config: a.config,
    shareSlug: a.shareSlug,
    shareEnabled: a.shareEnabled,
    contentWarning: a.contentWarning,
    moderationStatus: a.moderationStatus,
    moderationReason: a.moderationReason,
    editable,
    updatedAt: a.updatedAt,
  };
}
export type PublicAgent = ReturnType<typeof publicAgent>;

export async function getAgentById(id: string) {
  const db = await getDb();
  const [a] = await db.select().from(schema.agents).where(eq(schema.agents.id, id));
  return a ?? null;
}

export async function getAgentBySlug(slug: string) {
  const db = await getDb();
  const [a] = await db.select().from(schema.agents).where(eq(schema.agents.shareSlug, slug));
  return a ?? null;
}

/** Validates + runs the Task Guard. Throws ApiError on invalid / blocked / guard unavailable. */
async function validateAndGuard(input: unknown, agentId: string | null) {
  const parsed = agentConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(400, "Agent tanımı geçersiz.", { issues: parsed.error.issues });
  }
  const config = parsed.data;
  const ipHash = await clientIpHash();
  const admin = await isAdmin();
  if (!admin && (await isIpCooledDown(ipHash))) {
    throw new ApiError(429, "Çok sayıda reddedilen deneme yapıldı. Lütfen bir saat sonra tekrar deneyin.");
  }
  let verdict;
  try {
    verdict = await guardConfig(config);
  } catch (e) {
    if (e instanceof GuardUnavailableError) throw new ApiError(503, e.message);
    throw e;
  }
  if (verdict.decision === "block") {
    await logSafetyEvent({ agentId, ipHash, layer: verdict.layer, decision: "block", categories: verdict.categories, reason: verdict.reason });
    throw new ApiError(422, verdict.reason, { categories: verdict.categories, layer: verdict.layer });
  }
  if (verdict.decision === "warn") {
    await logSafetyEvent({ agentId, ipHash, layer: verdict.layer, decision: "warn", categories: verdict.categories, reason: verdict.reason });
  }
  return { config, verdict, admin };
}

export async function createAgent(input: unknown) {
  const id = newId("ag");
  const { config, verdict, admin } = await validateAndGuard(input, null);
  const token = newToken();
  const db = await getDb();
  const [row] = await db
    .insert(schema.agents)
    .values({
      id,
      owner: admin ? "admin" : "anon",
      editTokenHash: hashToken(token),
      name: config.name,
      config,
      shareSlug: newSlug(),
      shareEnabled: verdict.decision === "allow",
      contentWarning: verdict.contentWarning,
      moderationStatus: verdict.decision,
      moderationReason: verdict.reason || null,
    })
    .returning();
  (await cookies()).set(editCookieName(id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  return publicAgent(row, true);
}

export async function updateAgent(id: string, input: unknown) {
  const existing = await getAgentById(id);
  if (!existing) throw new ApiError(404, "Agent bulunamadı.");
  if (!(await canEditAgent(existing))) throw new ApiError(403, "Bu agent'ı düzenleme yetkiniz yok.");
  const { config, verdict } = await validateAndGuard(input, id);
  const db = await getDb();
  const frozen = existing.reportCount > 0 && existing.moderationStatus === "warn";
  const [row] = await db
    .update(schema.agents)
    .set({
      name: config.name,
      config: config as AgentConfig,
      contentWarning: verdict.contentWarning,
      moderationStatus: frozen ? "warn" : verdict.decision,
      moderationReason: frozen ? existing.moderationReason : verdict.reason || null,
      shareEnabled: !frozen && verdict.decision === "allow",
      updatedAt: new Date(),
    })
    .where(eq(schema.agents.id, id))
    .returning();
  return publicAgent(row, true);
}

/** Layer 4: a report freezes the share link immediately and queues it for admin review. */
export async function reportAgent(id: string, reason: string) {
  const a = await getAgentById(id);
  if (!a) throw new ApiError(404, "Agent bulunamadı.");
  const db = await getDb();
  await db
    .update(schema.agents)
    .set({
      shareEnabled: false,
      moderationStatus: "warn",
      moderationReason: `Bildirildi: ${reason.slice(0, 300)}`,
      reportCount: a.reportCount + 1,
    })
    .where(eq(schema.agents.id, id));
  await logSafetyEvent({ agentId: id, ipHash: await clientIpHash(), layer: 4, decision: "warn", categories: ["report"], reason });
}

export function apiErrorResponse(e: unknown) {
  if (e instanceof ApiError) return Response.json({ error: e.message, ...e.extra }, { status: e.status });
  if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 429)
    return Response.json({ error: String((e as { message?: unknown }).message ?? "") }, { status: 429 });
  console.error(e);
  return Response.json({ error: "Beklenmeyen bir hata oluştu." }, { status: 500 });
}
