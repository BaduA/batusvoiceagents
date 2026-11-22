import "server-only";
import { LLM_MODELS, REALTIME_MODELS, STT_MODELS, TTS_MODELS } from "@vap/core";
import { mockEnabled } from "./mock-llm";

const hasKey = (k: string) => Boolean(process.env[k]?.trim());

export const voiceConfigured = () => hasKey("LIVEKIT_URL") && hasKey("LIVEKIT_API_KEY") && hasKey("LIVEKIT_API_SECRET");

/** LiveKit Inference is available when the worker talks to LiveKit Cloud (or it is forced on). */
export const inferenceEnabled = () =>
  process.env.LIVEKIT_INFERENCE === "1" || (process.env.LIVEKIT_INFERENCE !== "0" && /\.livekit\.cloud/.test(process.env.LIVEKIT_URL ?? ""));

/** What the UI may offer: every catalog entry + whether it can run. Never returns keys. */
export function providerAvailability() {
  const inf = inferenceEnabled();
  const voiceOk = voiceConfigured();
  const ok = (m: { envKey: string; inference?: string }) => voiceOk && (hasKey(m.envKey) || (inf && Boolean(m.inference)));
  const strip = <T extends { envKey: string }>(m: T): Omit<T, "envKey"> => {
    const copy: Partial<T> = { ...m };
    delete copy.envKey;
    return copy as Omit<T, "envKey">;
  };
  return {
    voice: voiceOk,
    llm: LLM_MODELS.map((m) => ({ ...strip(m), available: ok(m) })),
    stt: STT_MODELS.map((m) => ({ ...strip(m), available: ok(m) })),
    tts: TTS_MODELS.map((m) => ({ ...strip(m), available: ok(m) })),
    realtime: REALTIME_MODELS.map((m) => ({ ...strip(m), available: ok(m) })),
    mock: mockEnabled(),
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null,
  };
}

export type ProviderAvailability = ReturnType<typeof providerAvailability>;

/** Utility LLM calls (Task Guard classifier) run in the web app and need the provider's own key. */
export function isLlmAvailable(id: string) {
  const m = LLM_MODELS.find((x) => x.id === id);
  return Boolean(m && (mockEnabled() || hasKey(m.envKey)));
}

export function defaultLlmId() {
  return LLM_MODELS.find((m) => m.tier === "standard" && (mockEnabled() || hasKey(m.envKey)))?.id ?? null;
}
