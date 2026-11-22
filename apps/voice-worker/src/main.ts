import "dotenv/config";
import { fileURLToPath } from "node:url";
import {
  cli,
  defineAgent,
  metrics,
  ServerOptions,
  voice,
  type JobContext,
  type JobProcess,
} from "@livekit/agents";
import * as silero from "@livekit/agents-plugin-silero";
import { detectInjection, replyViolates } from "@vap/core";
import { fetchBoot, postEvent, type TurnMetrics, type VoiceBoot } from "./backend.js";
import { buildLlm, buildRealtime, buildStt, buildTts } from "./models.js";

/** Must match WORKER_AGENT_NAME in apps/web/src/lib/voice.ts (explicit dispatch). */
const AGENT_NAME = "vap-agent";
/** Data channel topic the browser listens on for metrics and call state. */
const TOPIC = "vap";

type RoomMessage =
  | { type: "turn"; metrics: TurnMetrics }
  | { type: "error"; message: string }
  | { type: "time_warning"; secondsLeft: number }
  | { type: "ended"; reason: "time_limit" | "error" };

const TURN_MODE = process.env.TURN_DETECTION ?? "multilingual";
// The turn-detector plugin registers an ONNX model at import time (`pnpm download-files` fetches it),
// so it is only loaded when that detector is actually used.
const livekit = TURN_MODE === "multilingual" ? await import("@livekit/agents-plugin-livekit") : null;

function turnDetection() {
  if (TURN_MODE === "vad" || TURN_MODE === "stt" || !livekit) return TURN_MODE === "stt" ? ("stt" as const) : ("vad" as const);
  try {
    return new livekit.turnDetector.MultilingualModel();
  } catch (e) {
    console.warn("multilingual turn detector unavailable, falling back to VAD", e);
    return "vad";
  }
}

function buildSession(boot: VoiceBoot, vad: silero.VAD) {
  if (boot.mode === "realtime") {
    if (!boot.realtime) throw new Error("Realtime model seçilmemiş.");
    return new voice.AgentSession({ llm: buildRealtime(boot.realtime, boot.voice) });
  }
  if (!boot.stt || !boot.llm || !boot.tts) throw new Error("STT, LLM veya TTS seçilmemiş.");
  return new voice.AgentSession({
    vad,
    stt: buildStt(boot.stt, boot.language),
    llm: buildLlm(boot.llm),
    tts: buildTts(boot.tts, boot.voice, boot.language),
    turnHandling: {
      turnDetection: turnDetection(),
      // Start generating while the user may still be finishing: lowers end-of-speech → first-audio.
      preemptiveGeneration: { enabled: true },
    },
  });
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const { sessionId } = JSON.parse(ctx.job.metadata || "{}") as { sessionId?: string };
    if (!sessionId) throw new Error("job metadata has no sessionId");

    await ctx.connect();
    const send = (m: RoomMessage) =>
      ctx.room.localParticipant
        ?.publishData(new TextEncoder().encode(JSON.stringify(m)), { reliable: true, topic: TOPIC })
        .catch(() => {});

    const startedAt = Date.now();
    const usage = { sttAudioSeconds: 0, llmInputTokens: 0, llmOutputTokens: 0, ttsCharacters: 0 };
    let ended = false;
    const finish = async () => {
      if (ended) return;
      ended = true;
      await postEvent(sessionId, { type: "end", durationSec: (Date.now() - startedAt) / 1000, usage });
    };
    ctx.addShutdownCallback(finish);

    let boot: VoiceBoot;
    let session: voice.AgentSession;
    try {
      boot = await fetchBoot(sessionId);
      session = buildSession(boot, ctx.proc.userData.vad as silero.VAD);
    } catch (e) {
      console.error(e);
      send({ type: "error", message: `Ses oturumu başlatılamadı: ${(e as Error).message}` });
      send({ type: "ended", reason: "error" });
      await finish();
      ctx.shutdown("boot_failed");
      return;
    }

    // ---- per-turn latency: user stops speaking → first agent audio ----
    const turns = new Map<string, TurnMetrics>();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, ({ metrics: m }) => {
      const speechId = "speechId" in m ? m.speechId : undefined;
      const t = speechId ? (turns.get(speechId) ?? { at: Date.now() }) : null;
      switch (m.type) {
        case "stt_metrics":
          usage.sttAudioSeconds += m.audioDurationMs / 1000;
          break;
        case "eou_metrics":
          if (t) {
            t.eou = Math.round(m.endOfUtteranceDelayMs);
            t.stt = Math.round(m.transcriptionDelayMs);
          }
          break;
        case "llm_metrics":
          usage.llmInputTokens += m.promptTokens;
          usage.llmOutputTokens += m.completionTokens;
          if (t && t.llm_first_token === undefined) t.llm_first_token = Math.round(m.ttftMs);
          break;
        case "tts_metrics":
          usage.ttsCharacters += m.charactersCount;
          if (t && t.tts_first_audio === undefined) {
            t.tts_first_audio = Math.round(m.ttfbMs);
            // Greeting / tool replies have no user turn before them: report TTS only.
            t.first_audio = (t.eou ?? 0) + (t.llm_first_token ?? 0) + t.tts_first_audio;
            send({ type: "turn", metrics: { ...t } });
            void postEvent(sessionId, { type: "turn_metrics", metrics: { ...t } });
          }
          break;
      }
      if (t && speechId) turns.set(speechId, t);
    });
    session.on(voice.AgentSessionEventTypes.MetricsCollected, ({ metrics: m }) => metrics.logMetrics(m));

    // ---- transcripts → database (masked server-side) + Layer 3 runtime checks ----
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
      if (item.type !== "message") return;
      const text = item.textContent?.trim();
      if (!text || (item.role !== "user" && item.role !== "assistant")) return;
      void postEvent(sessionId, { type: "message", role: item.role, text });
      if (item.role === "user" && detectInjection(text)) {
        void postEvent(sessionId, { type: "safety", decision: "warn", categories: ["prompt_injection"], reason: text.slice(0, 500) });
      }
      if (item.role === "assistant" && replyViolates(text)) {
        void postEvent(sessionId, { type: "safety", decision: "block", categories: ["sensitive_data_harvest"], reason: "Asistan yanıtı hassas veri istedi" });
      }
    });

    session.on(voice.AgentSessionEventTypes.Error, ({ error }) => {
      console.error("session error", error);
      const msg = String((error as { error?: Error })?.error?.message ?? error);
      send({ type: "error", message: `Sağlayıcı hatası: ${msg.slice(0, 200)}` });
    });
    session.on(voice.AgentSessionEventTypes.Close, () => void finish());

    // ---- hard time limit ----
    const limitMs = boot.maxSeconds * 1000;
    const warn = setTimeout(() => {
      send({ type: "time_warning", secondsLeft: 15 });
    }, Math.max(0, limitMs - 15_000));
    const stop = setTimeout(async () => {
      send({ type: "ended", reason: "time_limit" });
      try {
        await session.say(boot.language === "tr" ? "Demo süremiz doldu, görüşmek üzere!" : "Our demo time is up, goodbye!", { allowInterruptions: false }).waitForPlayout();
      } catch {
        /* closing anyway */
      }
      await finish();
      ctx.shutdown("time_limit");
    }, limitMs);
    ctx.addShutdownCallback(async () => {
      clearTimeout(warn);
      clearTimeout(stop);
    });

    await session.start({ agent: new voice.Agent({ instructions: boot.instructions }), room: ctx.room });

    if (boot.greeting) session.say(boot.greeting);
    else session.generateReply({ instructions: "Kısaca kendini tanıt ve nasıl yardımcı olabileceğini sor." });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: AGENT_NAME }));
