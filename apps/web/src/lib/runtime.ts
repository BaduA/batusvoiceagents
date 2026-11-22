import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { streamText, type ModelMessage } from "ai";
import {
  buildSystemPrompt,
  detectInjection,
  estimateLlmCost,
  findLlm,
  maskText,
  replyViolates,
  SAFE_FALLBACK_REPLY,
  type AgentConfig,
} from "@vap/core";
import { getDb, schema } from "./db";
import { newId } from "./ids";
import { getLanguageModel, latencyProviderOptions } from "./llm";
import { consumeSession, LIMITS, LimitError } from "./limits";
import { defaultLlmId, isLlmAvailable } from "./providers";
import { logSafetyEvent } from "./safety";
import type { AgentRow } from "./agents";
import { ApiError } from "./agents";

export type ChatEvent =
  | { type: "session"; sessionId: string; llm: string; greeting?: string }
  | { type: "notice"; message: string }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | {
      type: "done";
      messageId: string;
      latency: { llm_first_token: number; total: number };
      usage: { input: number; output: number };
      costUsd: number;
      sessionCostUsd: number;
    }
  | { type: "error"; message: string };

export function resolveLlm(config: AgentConfig, override: string | undefined) {
  const wanted = override && findLlm(override) ? override : config.providers.llm;
  if (isLlmAvailable(wanted)) return { id: wanted, fallback: false };
  const d = defaultLlmId();
  if (!d) throw new ApiError(503, "Sunucuda hiçbir LLM sağlayıcı anahtarı yapılandırılmamış.");
  return { id: d, fallback: true };
}

export async function startSession(agent: AgentRow, ipHash: string, admin: boolean, llmId: string) {
  const premium = findLlm(llmId)?.tier === "premium";
  if (!admin) {
    try {
      await consumeSession(ipHash, premium);
    } catch (e) {
      if (e instanceof LimitError) throw new ApiError(429, e.message);
      throw e;
    }
  }
  const db = await getDb();
  const id = newId("ss");
  await db.insert(schema.sessions).values({
    id,
    agentId: agent.id,
    channel: "text",
    providerCombo: { mode: "text", llm: llmId },
    ipHash,
  });
  if (agent.config.greeting) {
    await db.insert(schema.messages).values({ id: newId("msg"), sessionId: id, role: "assistant", content: agent.config.greeting });
  }
  return id;
}

/** Runs one text turn and yields events. Persists user + assistant messages (masked). */
export async function* runTextTurn(opts: {
  agent: AgentRow;
  sessionId: string;
  llmId: string;
  userText: string;
  ipHash: string;
}): AsyncGenerator<ChatEvent> {
  const { agent, sessionId, llmId, ipHash } = opts;
  const db = await getDb();
  const userText = opts.userText.slice(0, 4000);

  const history = await db
    .select({ role: schema.messages.role, content: schema.messages.content })
    .from(schema.messages)
    .where(eq(schema.messages.sessionId, sessionId))
    .orderBy(asc(schema.messages.createdAt));

  if (history.filter((m) => m.role === "user").length >= LIMITS.maxMessagesPerSession()) {
    yield { type: "error", message: "Bu görüşmenin mesaj sınırına ulaşıldı. Yeni bir görüşme başlatın." };
    return;
  }

  if (detectInjection(userText)) {
    await logSafetyEvent({ agentId: agent.id, sessionId, ipHash, layer: 3, decision: "warn", categories: ["prompt_injection"], reason: maskText(userText).slice(0, 500) });
  }

  await db.insert(schema.messages).values({ id: newId("msg"), sessionId, role: "user", content: maskText(userText) });

  const messages: ModelMessage[] = [
    ...history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userText },
  ];
  // Providers require the first message to be from the user; a greeting-first history gets a stub.
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: "(görüşme başladı)" });

  const t0 = performance.now();
  let firstToken = 0;
  let text = "";
  let usage = { input: 0, output: 0 };

  try {
    const result = streamText({
      model: getLanguageModel(llmId),
      // Actions are stored but not exposed as tools until the action simulator lands (phase 5).
      instructions: buildSystemPrompt({ ...agent.config, actions: [] }),
      messages,
      maxOutputTokens: 600,
      providerOptions: latencyProviderOptions(llmId),
    });
    for await (const part of result.stream) {
      if (part.type === "text-delta") {
        if (!firstToken) firstToken = performance.now() - t0;
        text += part.text;
        yield { type: "delta", text: part.text };
      } else if (part.type === "finish") {
        usage = { input: part.totalUsage.inputTokens ?? 0, output: part.totalUsage.outputTokens ?? 0 };
      } else if (part.type === "error") {
        throw part.error;
      }
    }
  } catch (e) {
    console.error("LLM error", e);
    const msg = e instanceof Error ? e.message : String(e);
    yield { type: "error", message: `Model yanıt veremedi (${findLlm(llmId)?.label ?? llmId}). ${providerErrorHint(msg)}` };
    return;
  }

  if (replyViolates(text)) {
    await logSafetyEvent({ agentId: agent.id, sessionId, ipHash, layer: 3, decision: "block", categories: ["sensitive_data_harvest"], reason: "Asistan yanıtı hassas veri istedi" });
    text = SAFE_FALLBACK_REPLY;
    yield { type: "replace", text };
  }

  const total = performance.now() - t0;
  const costUsd = estimateLlmCost(llmId, usage.input, usage.output);
  const messageId = newId("msg");
  await db.insert(schema.messages).values({
    id: messageId,
    sessionId,
    role: "assistant",
    content: maskText(text),
    latencyMs: { llm_first_token: Math.round(firstToken), total: Math.round(total) },
    usage,
  });
  const [s] = await db
    .update(schema.sessions)
    .set({ estCostUsd: sql`${schema.sessions.estCostUsd} + ${costUsd}`, endedAt: new Date() })
    .where(eq(schema.sessions.id, sessionId))
    .returning({ cost: schema.sessions.estCostUsd });

  yield {
    type: "done",
    messageId,
    latency: { llm_first_token: Math.round(firstToken), total: Math.round(total) },
    usage,
    costUsd,
    sessionCostUsd: Number(s?.cost ?? costUsd),
  };
}

function providerErrorHint(msg: string) {
  if (/401|api key|authentication/i.test(msg)) return "Sağlayıcı anahtarı geçersiz.";
  if (/429|rate/i.test(msg)) return "Sağlayıcı hız sınırına ulaşıldı, biraz sonra tekrar deneyin.";
  if (/safety|policy|refus|content/i.test(msg)) return "Sağlayıcı bu isteği kullanım politikası nedeniyle reddetti.";
  return "Lütfen tekrar deneyin veya başka bir model seçin.";
}
