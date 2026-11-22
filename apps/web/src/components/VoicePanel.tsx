"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import type { AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import type { RoomMessage, TranscriptLine, TurnLatency, VoiceStartResponse } from "@/lib/client/types";
import { LatencyStrip } from "./LatencyStrip";
import { Turnstile } from "./Turnstile";

const CONSENT_KEY = "vap.voiceConsent.v1";
const noopSubscribe = () => () => {};
const readConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
};

type Phase = "idle" | "starting" | "live" | "ended";

export interface CallResult {
  sessionId: string;
  lines: TranscriptLine[];
  turns: TurnLatency[];
  combo: VoiceStartResponse["combo"];
  durationSec: number;
}

export function VoicePanel(props: {
  config: AgentConfig;
  agentId: string | null;
  ensureSaved: () => Promise<string | null>;
  providers: ProviderAvailability | null;
  providerOverride: Partial<AgentConfig["providers"]>;
  contentWarning: boolean;
  onLive: (data: { lines: TranscriptLine[]; turns: TurnLatency[]; elapsed: number; combo: VoiceStartResponse["combo"]; sessionId: string } | null) => void;
  onEnded: (r: CallResult) => void;
}) {
  const { config, ensureSaved, providers, providerOverride, contentWarning, onLive, onEnded } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [conn, setConn] = useState<VoiceStartResponse | null>(null);
  const [lastLines, setLastLines] = useState<TranscriptLine[]>([]);
  const [lastTurns, setLastTurns] = useState<TurnLatency[]>([]);

  const storedConsent = useSyncExternalStore(noopSubscribe, readConsent, () => false);

  const siteKey = providers?.turnstileSiteKey ?? null;
  const consented = consent || storedConsent;
  const canStart = consented && (!siteKey || turnstileToken) && phase !== "starting" && providers?.voice !== false;

  async function start() {
    setError(null);
    setPhase("starting");
    const agentId = await ensureSaved();
    if (!agentId) {
      setPhase("idle");
      return;
    }
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    const res = await fetch("/api/voice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, consent: true, turnstileToken: turnstileToken ?? undefined, providers: providerOverride }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Görüşme başlatılamadı.");
      setPhase("idle");
      return;
    }
    setLastLines([]);
    setLastTurns([]);
    setConn(j as VoiceStartResponse);
    setPhase("live");
  }

  const handleEnded = useCallback(
    (r: Omit<CallResult, "sessionId" | "combo">) => {
      if (!conn) return;
      setLastLines(r.lines);
      setLastTurns(r.turns);
      setPhase("ended");
      onEnded({ ...r, sessionId: conn.sessionId, combo: conn.combo });
      setConn(null);
    },
    [conn, onEnded],
  );

  const speaker = config.name || "Agent";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-rule px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-bold leading-6">{speaker}</h2>
          {config.company.name && <p className="truncate text-[13px] text-graphite">{config.company.name}</p>}
        </div>
      </header>
      {contentWarning && <p className="border-b border-rule bg-needle-soft/60 px-5 py-2 text-[13px] text-ink">Bu agent argo veya sert dil içerebilir.</p>}

      {phase === "live" && conn ? (
        <LiveKitRoom
          serverUrl={conn.serverUrl}
          token={conn.token}
          connect
          audio
          video={false}
          className="flex min-h-0 flex-1 flex-col"
          onError={(e) => setError(e.message)}
        >
          <RoomAudioRenderer />
          <LiveCall speaker={speaker} maxSeconds={conn.maxSeconds} onTick={(d) => onLive({ ...d, combo: conn.combo, sessionId: conn.sessionId })} onEnded={handleEnded} onError={setError} error={error} />
        </LiveKitRoom>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-5">
            <Transcript speaker={speaker} lines={lastLines} turns={lastTurns} />
            {phase !== "ended" && (
              <IdleIntro speaker={speaker} greeting={config.greeting} voiceReady={providers?.voice ?? true} />
            )}
          </div>
          <div className="border-t border-rule px-4 py-4 sm:px-5">
            {error && (
              <p role="alert" className="mb-3 rounded-[var(--radius-field)] bg-fault-soft px-3 py-2 text-[14px] text-fault">
                {error}
              </p>
            )}
            {!consented && (
              <label className="mb-3 flex items-start gap-2.5 text-[14px] leading-5 text-ink">
                <input type="checkbox" className="mt-0.5 size-4 accent-[var(--ink)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Sesim yazıya çevrilip yapay zekâ sağlayıcılarına iletilecek; transkript {""}
                  <span className="whitespace-nowrap">birkaç gün</span> sonra silinecek. Gerçek kişisel bilgi, kart veya şifre söylemeyeceğim.
                </span>
              </label>
            )}
            {siteKey && consented && !turnstileToken && <Turnstile siteKey={siteKey} onToken={setTurnstileToken} />}
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button onClick={start} disabled={!canStart} className="btn-primary h-12 text-[16px] sm:px-8">
                <MicIcon />
                {phase === "starting" ? "Bağlanıyor…" : phase === "ended" ? "Yeniden ara" : "Görüşmeyi başlat"}
              </button>
              <span className="text-[13px] leading-5 text-graphite">Mikrofon izni istenecek. Görüşme en fazla 3 dakika sürer.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IdleIntro({ speaker, greeting, voiceReady }: { speaker: string; greeting: string; voiceReady: boolean }) {
  return (
    <div className="mx-auto mt-6 max-w-[40rem] text-[15px] leading-7 text-graphite">
      {!voiceReady ? (
        <p>Sesli mod sunucuda henüz yapılandırılmamış (LiveKit ayarları eksik).</p>
      ) : (
        <p>
          Görüşmeyi başlatınca {speaker} {greeting ? <>“{greeting}” diyerek</> : "kendini tanıtarak"} açacak. Müşteri gibi konuşun; söyledikleriniz ve cevaplar burada yazıya dökülür, her cevabın ne kadar sürede geldiği altında görünür.
        </p>
      )}
    </div>
  );
}

function Transcript({ speaker, lines, turns }: { speaker: string; lines: TranscriptLine[]; turns: TurnLatency[] }) {
  let agentIdx = -1;
  if (lines.length === 0) return null;
  return (
    <ol className="mx-auto max-w-[44rem] space-y-6">
      {lines.map((l) => {
        const isAgent = l.role === "assistant";
        if (isAgent) agentIdx++;
        const latency = isAgent ? turns[agentIdx] : undefined;
        return (
          <li key={l.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
            <span className={`pt-0.5 text-[13px] font-medium sm:text-right ${isAgent ? "text-ink" : "text-graphite"}`}>{isAgent ? speaker : "Siz"}</span>
            <div className={isAgent ? "" : "border-l-2 border-rule pl-3"}>
              <p className={`whitespace-pre-wrap text-[16px] leading-7 ${isAgent ? "text-ink" : "text-graphite"} ${l.final ? "" : "opacity-70"}`}>{l.text}</p>
              {latency && <LatencyStrip latency={latency} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const STATE_LABEL: Record<string, string> = {
  connecting: "Bağlanıyor",
  initializing: "Agent hazırlanıyor",
  "pre-connect-buffering": "Agent hazırlanıyor",
  listening: "Dinliyor",
  thinking: "Düşünüyor",
  speaking: "Konuşuyor",
  idle: "Bekliyor",
  disconnected: "Bağlantı kapandı",
  failed: "Bağlantı kurulamadı",
};

function LiveCall({
  speaker,
  maxSeconds,
  onTick,
  onEnded,
  onError,
  error,
}: {
  speaker: string;
  maxSeconds: number;
  onTick: (d: { lines: TranscriptLine[]; turns: TurnLatency[]; elapsed: number }) => void;
  onEnded: (r: { lines: TranscriptLine[]; turns: TurnLatency[]; durationSec: number }) => void;
  onError: (m: string | null) => void;
  error: string | null;
}) {
  const room = useRoomContext();
  const { state, agent } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const streams = useTranscriptions();
  const [turns, setTurns] = useState<TurnLatency[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const endedRef = useRef(false);

  useDataChannel("vap", (msg) => {
    let m: RoomMessage;
    try {
      m = JSON.parse(new TextDecoder().decode(msg.payload)) as RoomMessage;
    } catch {
      return;
    }
    if (m.type === "turn") setTurns((t) => [...t, m.metrics]);
    else if (m.type === "error") onError(m.message);
    else if (m.type === "time_warning") setNotice(`Görüşmenin bitmesine ${m.secondsLeft} saniye kaldı.`);
    else if (m.type === "ended" && m.reason === "time_limit") setNotice("Demo süresi doldu.");
  });

  const lines: TranscriptLine[] = useMemo(
    () =>
      streams
        .filter((s) => s.text.trim())
        .map((s) => ({
          id: s.streamInfo.id,
          role: agent && s.participantInfo.identity === agent.identity ? "assistant" : "user",
          text: s.text,
          final: s.streamInfo.attributes?.["lk.transcription_final"] !== "false",
        })),
    [streams, agent],
  );

  useEffect(() => {
    startedAt.current = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(iv);
  }, []);

  // Keep the latest callback in a ref so a new parent closure doesn't re-trigger the effect.
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });
  useEffect(() => onTickRef.current({ lines, turns, elapsed }), [lines, turns, elapsed]);

  const end = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    onEnded({ lines, turns, durationSec: (Date.now() - startedAt.current) / 1000 });
    void room.disconnect();
  }, [lines, turns, onEnded, room]);

  // Worker left (time limit, error) → end the call on our side too.
  useEffect(() => {
    if (state === "disconnected" && elapsed > 2) end();
  }, [state, elapsed, end]);

  const remaining = Math.max(0, maxSeconds - elapsed);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-5" aria-live="polite">
        <Transcript speaker={speaker} lines={lines} turns={turns} />
        {lines.length === 0 && <p className="mx-auto mt-6 max-w-[40rem] text-[15px] text-graphite">{STATE_LABEL[state] ?? "Bağlanıyor"}…</p>}
      </div>
      <div className="border-t border-rule px-4 py-4 sm:px-5">
        {(error || notice) && (
          <p role="status" className={`mb-3 rounded-[var(--radius-field)] px-3 py-2 text-[14px] ${error ? "bg-fault-soft text-fault" : "bg-needle-soft/70 text-ink"}`}>
            {error ?? notice}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <StateNeedle state={state} />
          <span className="min-w-[7rem] text-[15px] font-medium">{STATE_LABEL[state] ?? state}</span>
          <span className="font-mono text-[14px] tabular-nums text-graphite" title="Kalan süre">
            {mmss(remaining)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="btn-quiet h-11"
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
              aria-pressed={!isMicrophoneEnabled}
            >
              {isMicrophoneEnabled ? "Sessize al" : "Mikrofonu aç"}
            </button>
            <button className="btn h-11 bg-ink text-sheet hover:bg-ink/90" onClick={end}>
              Görüşmeyi bitir
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** The one accent: a needle dot that pulses while the agent speaks and breathes while it listens. */
function StateNeedle({ state }: { state: string }) {
  const speaking = state === "speaking";
  const thinking = state === "thinking";
  return (
    <span
      aria-hidden
      className={`inline-block size-4 rounded-full ${speaking ? "bg-needle" : thinking ? "bg-needle/60" : state === "listening" ? "bg-pass" : "bg-rule"}`}
      style={speaking ? { animation: "needle-pulse 1.1s ease-out infinite" } : undefined}
    />
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
