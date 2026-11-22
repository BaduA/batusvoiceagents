import { inference, type llm as llmNs, type stt as sttNs, type tts as ttsNs } from "@livekit/agents";
import * as anthropic from "@livekit/agents-plugin-anthropic";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as elevenlabs from "@livekit/agents-plugin-elevenlabs";
import * as google from "@livekit/agents-plugin-google";
import * as openai from "@livekit/agents-plugin-openai";
import type { ResolvedModel } from "./backend.js";

/**
 * Provider adapters. Each model runs with the provider's own key when it is set,
 * otherwise through LiveKit Inference (LiveKit Cloud). Adding a provider = one case here
 * + one row in packages/core/src/catalog.ts.
 */

const ownKey = (m: ResolvedModel) => Boolean(process.env[m.envKey === "GOOGLE_GENERATIVE_AI_API_KEY" ? "GOOGLE_API_KEY" : m.envKey]);

function needInference(m: ResolvedModel): string {
  if (!m.inference) throw new Error(`${m.id} için ${m.envKey} gerekli (LiveKit Inference bu modeli sunmuyor).`);
  return m.inference;
}

export function buildStt(m: ResolvedModel, language: string): sttNs.STT {
  if (ownKey(m)) {
    switch (m.provider) {
      case "deepgram":
        return new deepgram.STT({ model: m.model as never, language });
      case "openai":
        return new openai.STT({ model: m.model, language });
    }
  }
  return new inference.STT({ model: `${needInference(m)}:${language}` as never });
}

export function buildLlm(m: ResolvedModel): llmNs.LLM {
  if (ownKey(m)) {
    switch (m.provider) {
      case "anthropic":
        return new anthropic.LLM({ model: m.model, maxTokens: 400 });
      case "openai":
        return new openai.LLM({ model: m.model });
      case "google":
        return new google.LLM({ model: m.model as never });
    }
  }
  return new inference.LLM({ model: needInference(m) });
}

export function buildTts(m: ResolvedModel, voice: string, language: string): ttsNs.TTS {
  if (ownKey(m)) {
    switch (m.provider) {
      case "cartesia":
        return new cartesia.TTS({ model: m.model, voice, language });
      case "elevenlabs":
        return new elevenlabs.TTS({ modelID: m.model, voiceId: voice, languageCode: language } as never);
      case "openai":
        return new openai.TTS({ model: m.model, voice: voice as never });
    }
  }
  return new inference.TTS({ model: needInference(m) as never, voice, language });
}

export function buildRealtime(m: ResolvedModel, voice: string): llmNs.RealtimeModel {
  if (ownKey(m)) {
    switch (m.provider) {
      case "openai":
        return new openai.realtime.RealtimeModel({ model: m.model, ...(voice ? { voice } : {}) } as never);
      case "google":
        return new google.realtime.RealtimeModel({ model: m.model, ...(voice ? { voice } : {}) } as never);
    }
  }
  return new inference.RealtimeModel({ model: needInference(m), ...(voice ? { voice } : {}) });
}
