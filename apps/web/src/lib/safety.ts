import "server-only";
import { generateText } from "ai";
import { GuardUnavailableError, runTaskGuard, UTILITY_LLM_ID, type AgentConfig } from "@vap/core";
import { getDb, schema } from "./db";
import { newId } from "./ids";
import { getLanguageModel, latencyProviderOptions } from "./llm";
import { defaultLlmId, isLlmAvailable } from "./providers";

/** Layer 2 classifier call. Uses the utility model, or any configured standard model. */
async function classify(instructions: string, input: string) {
  const id = isLlmAvailable(UTILITY_LLM_ID) ? UTILITY_LLM_ID : defaultLlmId();
  if (!id) throw new GuardUnavailableError("Güvenlik sınıflandırıcısı için bir LLM anahtarı gerekli.");
  const { text } = await generateText({
    model: getLanguageModel(id),
    instructions,
    prompt: input,
    maxOutputTokens: 400,
    timeout: 15_000,
    providerOptions: latencyProviderOptions(id),
  });
  return text;
}

export async function guardConfig(config: AgentConfig) {
  return runTaskGuard(config, classify);
}

export async function logSafetyEvent(e: {
  agentId?: string | null;
  sessionId?: string | null;
  ipHash: string;
  layer: number;
  decision: string;
  categories?: string[];
  reason?: string;
}) {
  const db = await getDb();
  await db.insert(schema.safetyEvents).values({
    id: newId("se"),
    agentId: e.agentId ?? null,
    sessionId: e.sessionId ?? null,
    ipHash: e.ipHash,
    layer: e.layer,
    decision: e.decision,
    categories: e.categories ?? [],
    reason: e.reason ?? null,
  });
}
