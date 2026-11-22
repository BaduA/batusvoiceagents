import "server-only";
import { LLM_MODELS, REALTIME_MODELS, STT_MODELS, TTS_MODELS } from "@vap/core";

import { mockEnabled } from "./mock-llm";

const hasKey = (k: string) => Boolean(process.env[k]?.trim());
/** LLM availability also counts the dev mock. */
const has = (k: string) => mockEnabled() || hasKey(k);

/** What the UI may offer: every catalog entry + whether its key is configured. Never returns keys. */
export function providerAvailability() {
  const map = <T extends { envKey: string }>(xs: T[], check = hasKey) =>
    xs.map(({ envKey, ...rest }) => ({ ...rest, available: check(envKey) }));
  return {
    llm: map(LLM_MODELS, has),
    stt: map(STT_MODELS),
    tts: map(TTS_MODELS),
    realtime: map(REALTIME_MODELS),
    mock: mockEnabled(),
  };
}

export type ProviderAvailability = ReturnType<typeof providerAvailability>;

export function isLlmAvailable(id: string) {
  const m = LLM_MODELS.find((x) => x.id === id);
  return Boolean(m && has(m.envKey));
}

/** First configured standard-tier LLM, used as fallback when the selected one has no key. */
export function defaultLlmId() {
  return LLM_MODELS.find((m) => m.tier === "standard" && has(m.envKey))?.id ?? null;
}
