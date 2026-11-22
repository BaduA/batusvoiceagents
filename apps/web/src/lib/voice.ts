import "server-only";
import { eq, sql } from "drizzle-orm";
import { AccessToken, RoomAgentDispatch, RoomConfiguration } from "livekit-server-sdk";
import {
  buildSystemPrompt,
  estimateVoiceCost,
  findLlm,
  findRealtime,
  findStt,
  findTts,
  LLM_MODELS,
  type AgentConfig,
  type ProviderSelection,
} from "@vap/core";
import { getDb, schema } from "./db";
import type { TurnMetrics } from "./db/schema";
import { newId } from "./ids";
import { consumeSession, LIMITS, LimitError } from "./limits";
import { providerAvailability } from "./providers";
import { ApiError, type AgentRow } from "./agents";

/** Name the worker registers with; tokens dispatch exactly this agent into the room. */
export const WORKER_AGENT_NAME = "vap-agent";

export type VoiceCombo = {
  mode: "pipeline" | "realtime";
  stt: string;
  llm: string;
  tts: string;
  voice: string;
  realtime: string;
};

/** Merges the agent's saved providers with the per-call override and checks they can run. */
export function resolveCombo(config: AgentConfig, override: Partial<ProviderSelection> | undefined): VoiceCombo {
  const p = { ...config.providers, ...(override ?? {}) };
  const avail = providerAvailability();
  if (!avail.voice) throw new ApiError(503, "Sesli mod sunucuda yapılandırılmamış (LiveKit ayarları eksik).");
  const okIn = (list: { id: string; available: boolean }[], id: string) => list.some((m) => m.id === id && m.available);
  const firstOk = (list: { id: string; available: boolean }[]) => list.find((m) => m.available)?.id;

  if (p.mode === "realtime") {
    const realtime = okIn(avail.realtime, p.realtime) ? p.realtime : firstOk(avail.realtime);
    if (!realtime) throw new ApiError(503, "Kullanılabilir bir realtime model yok.");
    return { mode: "realtime", stt: "", llm: "", tts: "", voice: p.voice, realtime };
  }
  const stt = okIn(avail.stt, p.stt) ? p.stt : firstOk(avail.stt);
  const llm = okIn(avail.llm, p.llm) ? p.llm : firstOk(avail.llm);
  const tts = okIn(avail.tts, p.tts) ? p.tts : firstOk(avail.tts);
  if (!stt || !llm || !tts) throw new ApiError(503, "Ses için gerekli STT, LLM veya TTS sağlayıcısı yapılandırılmamış.");
  const ttsModel = findTts(tts)!;
  const voice = ttsModel.voices.some((v) => v.id === p.voice) || (p.voice && tts === p.tts) ? p.voice : ttsModel.voices[0].id;
  return { mode: "pipeline", stt, llm, tts, voice, realtime: "" };
}

function isPremium(c: VoiceCombo) {
  if (c.mode === "realtime") return findRealtime(c.realtime)?.tier === "premium";
  return findLlm(c.llm)?.tier === "premium";
}

export async function verifyTurnstile(token: string | undefined, ipHint: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ipHint });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const j = (await r.json().catch(() => ({}))) as { success?: boolean };
  return Boolean(j.success);
}

export async function startVoiceSession(agent: AgentRow, combo: VoiceCombo, ipHash: string, admin: boolean) {
  if (!admin) {
    try {
      await consumeSession(ipHash, isPremium(combo));
    } catch (e) {
      if (e instanceof LimitError) throw new ApiError(429, e.message);
      throw e;
    }
  }
  const db = await getDb();
  const sessionId = newId("ss");
  await db.insert(schema.sessions).values({
    id: sessionId,
    agentId: agent.id,
    channel: combo.mode === "realtime" ? "realtime" : "voice",
    providerCombo: combo,
    ipHash,
  });

  const identity = `user_${sessionId.slice(3)}`;
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name: "Test eden",
    ttl: "10m",
  });
  const room = `vap_${sessionId}`;
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
  at.roomConfig = new RoomConfiguration({
    agents: [new RoomAgentDispatch({ agentName: WORKER_AGENT_NAME, metadata: JSON.stringify({ sessionId }) })],
  });
  return {
    sessionId,
    serverUrl: process.env.LIVEKIT_URL!,
    token: await at.toJwt(),
    maxSeconds: admin ? 60 * 30 : LIMITS.maxVoiceSeconds(),
    combo,
  };
}

/** What the worker needs to run a session. Called by the worker with INTERNAL_API_SECRET. */
export async function voiceBootPayload(sessionId: string) {
  const db = await getDb();
  const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
  if (!s) throw new ApiError(404, "Görüşme bulunamadı.");
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, s.agentId));
  if (!agent) throw new ApiError(404, "Agent bulunamadı.");
  const combo = s.providerCombo as unknown as VoiceCombo;
  const resolve = <T extends { id: string; model: string; provider: string; inference?: string; envKey: string }>(m: T | undefined) =>
    m && { id: m.id, provider: m.provider, model: m.model, inference: m.inference ?? null, envKey: m.envKey };
  return {
    sessionId,
    agentId: agent.id,
    // Actions become tools in phase 5 (action simulator).
    instructions: buildSystemPrompt({ ...agent.config, actions: [] }),
    greeting: agent.config.greeting,
    language: agent.config.persona.language,
    maxSeconds: LIMITS.maxVoiceSeconds(),
    mode: combo.mode,
    stt: resolve(findStt(combo.stt)),
    llm: resolve(LLM_MODELS.find((m) => m.id === combo.llm)),
    tts: resolve(findTts(combo.tts)),
    voice: combo.voice,
    realtime: resolve(findRealtime(combo.realtime)),
    fillerPhrase: agent.config.persona.language === "tr" ? "Bir saniye, kontrol ediyorum." : "One moment, let me check.",
  };
}
export type VoiceBoot = Awaited<ReturnType<typeof voiceBootPayload>>;

export async function appendTurnMetrics(sessionId: string, m: TurnMetrics) {
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ turnMetrics: sql`${schema.sessions.turnMetrics} || ${JSON.stringify([m])}::jsonb` })
    .where(eq(schema.sessions.id, sessionId));
}

export async function endVoiceSession(sessionId: string, durationSec: number, usage: Record<string, number>) {
  const db = await getDb();
  const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
  if (!s || s.endedAt) return;
  const combo = s.providerCombo as unknown as VoiceCombo;
  const cost = estimateVoiceCost(combo, { ...usage, realtimeSeconds: combo.mode === "realtime" ? durationSec : undefined });
  await db
    .update(schema.sessions)
    .set({ endedAt: new Date(), durationSec: Math.round(durationSec), usage, estCostUsd: cost.toFixed(6) })
    .where(eq(schema.sessions.id, sessionId));
  await db
    .update(schema.usageLimits)
    .set({ totalSeconds: sql`${schema.usageLimits.totalSeconds} + ${Math.round(durationSec)}` })
    .where(sql`${schema.usageLimits.ipHash} = ${s.ipHash} AND ${schema.usageLimits.date} = ${new Date().toISOString().slice(0, 10)}`);
}
