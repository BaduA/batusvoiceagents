/**
 * Provider & model catalog + unit prices.
 *
 * PRICES CHANGE OFTEN. This is the one file to edit when they do.
 * All prices in USD. Verified/estimated on 2026-11-22 — check each provider's pricing page before relying on them.
 *
 * Ids are "<provider>:<model>" so a single string selects both the adapter and the model.
 */

export type Tier = "standard" | "premium";

export interface LlmModel {
  id: string;
  provider: "anthropic" | "openai" | "google";
  model: string;
  label: string;
  /** USD per 1M tokens */
  inputPerM: number;
  outputPerM: number;
  tier: Tier;
  envKey: string;
}

export interface SttModel {
  id: string;
  provider: "deepgram" | "openai";
  model: string;
  label: string;
  perMinute: number;
  envKey: string;
}

export interface TtsModel {
  id: string;
  provider: "elevenlabs" | "cartesia" | "openai";
  model: string;
  label: string;
  /** USD per 1K characters */
  per1kChars: number;
  envKey: string;
}

export interface RealtimeModel {
  id: string;
  provider: "openai" | "google";
  model: string;
  label: string;
  /** Blended estimate, USD per minute of conversation */
  perMinute: number;
  tier: Tier;
  envKey: string;
}

export const LLM_MODELS: LlmModel[] = [
  {
    id: "anthropic:claude-haiku-5-5",
    provider: "anthropic",
    model: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    inputPerM: 0.1,
    outputPerM: 0.5,
    tier: "standard",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "openai:gpt-5.4-mini",
    provider: "openai",
    model: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    inputPerM: 0.4, // estimate — verify
    outputPerM: 1.6, // estimate — verify
    tier: "standard",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "google:gemini-3.8-flash",
    provider: "google",
    model: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    inputPerM: 0.3, // estimate — verify
    outputPerM: 2.5, // estimate — verify
    tier: "standard",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
  {
    id: "anthropic:claude-sonnet-5-5",
    provider: "anthropic",
    model: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    inputPerM: 2,
    outputPerM: 10,
    tier: "premium",
    envKey: "ANTHROPIC_API_KEY",
  },
];

export const STT_MODELS: SttModel[] = [
  {
    id: "deepgram:nova-3",
    provider: "deepgram",
    model: "nova-3",
    label: "Deepgram Nova-3",
    perMinute: 0.0077, // estimate — verify
    envKey: "DEEPGRAM_API_KEY",
  },
  {
    id: "openai:gpt-live-transcribe",
    provider: "openai",
    model: "gpt-live-transcribe",
    label: "OpenAI Live Transcribe",
    perMinute: 0.006, // estimate — verify
    envKey: "OPENAI_API_KEY",
  },
];

export const TTS_MODELS: TtsModel[] = [
  {
    id: "cartesia:sonic-3",
    provider: "cartesia",
    model: "sonic-3",
    label: "Cartesia Sonic-3",
    per1kChars: 0.03, // estimate — verify
    envKey: "CARTESIA_API_KEY",
  },
  {
    id: "elevenlabs:eleven_flash_v2_5",
    provider: "elevenlabs",
    model: "eleven_flash_v2_5",
    label: "ElevenLabs Flash v2.5",
    per1kChars: 0.05, // estimate — verify
    envKey: "ELEVENLABS_API_KEY",
  },
  {
    id: "openai:gpt-4o-mini-tts",
    provider: "openai",
    model: "gpt-4o-mini-tts",
    label: "OpenAI TTS",
    per1kChars: 0.015, // estimate — verify (model scheduled for shutdown Jan 2027)
    envKey: "OPENAI_API_KEY",
  },
];

export const REALTIME_MODELS: RealtimeModel[] = [
  {
    id: "openai:gpt-realtime-2.1-mini",
    provider: "openai",
    model: "gpt-realtime-2.1-mini",
    label: "OpenAI Realtime mini",
    perMinute: 0.06, // estimate — verify
    tier: "standard",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "google:gemini-3.8-live",
    provider: "google",
    model: "gemini-3.8-live",
    label: "Gemini 3.8 Live",
    perMinute: 0.04, // estimate — verify
    tier: "standard",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  },
];

/** The small model used by Task Guard (Layer 2) and the action simulator. */
export const UTILITY_LLM_ID = "anthropic:claude-haiku-5-5";

export function findLlm(id: string) {
  return LLM_MODELS.find((m) => m.id === id);
}

export function estimateLlmCost(id: string, inputTokens: number, outputTokens: number) {
  const m = findLlm(id);
  if (!m) return 0;
  return (inputTokens * m.inputPerM + outputTokens * m.outputPerM) / 1_000_000;
}
