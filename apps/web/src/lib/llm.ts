import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { findLlm } from "@vap/core";
import { mockEnabled, mockModel } from "./mock-llm";

/**
 * LLM adapter: one function maps a catalog id to an AI SDK model.
 * Adding a provider = add it to the catalog + one case here.
 */
export function getLanguageModel(id: string): LanguageModel {
  const m = findLlm(id);
  if (!m) throw new Error(`Bilinmeyen model: ${id}`);
  if (mockEnabled()) return mockModel();
  switch (m.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(m.model);
    case "openai":
      return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(m.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })(m.model);
  }
}

/** Per-provider options tuned for low-latency conversational replies. */
export function latencyProviderOptions(id: string): Record<string, Record<string, string>> | undefined {
  const m = findLlm(id);
  if (m?.provider === "anthropic") return { anthropic: { effort: "low" } };
  if (m?.provider === "openai") return { openai: { reasoningEffort: "low" } };
  return undefined;
}
