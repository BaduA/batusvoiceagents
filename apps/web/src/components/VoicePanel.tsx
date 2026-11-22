"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useDataChannel,
  useLocalParticipant,
  useRoomContext,
  useTrackVolume,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import type { LocalAudioTrack } from "livekit-client";
import type { AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import type { RoomMessage, TranscriptLine, TurnLatency, VoiceStartResponse } from "@/lib/client/types";
import { LatencyStrip } from "./LatencyStrip";
import { Turnstile } from "./Turnstile";
import { VuDial } from "./ui/VuDial";
import { Switch } from "./ui/Switch";
import { IconMic, IconMicOff, IconPhone, IconPhoneDown, IconWarn } from "./ui/icons";

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
  subtitle?: string;
  onLive: (data: { lines: TranscriptLine[]; turns: TurnLatency[]; elapsed: number; combo: VoiceStartResponse["combo"]; sessionId: string } | null) => void;
  onEnded: (r: CallResult) => void;
}) {
  const { config, ensureSaved, providers, providerOverride, contentWarning, onLive, onEnded } = props;
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const storedConsent = useSyncExternalStore(noopSubscribe, readConsent, () => false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [conn, setConn] = useState<VoiceStartResponse | null>(null);
  const [lastLines, setLastLines] = useState<TranscriptLine[]>([]);
  const [lastTurns, setLastTurns] = useState<TurnLatency[]>([]);

  const siteKey = providers?.turnstileSiteKey ?? null;
  const consented = consent || storedConsent;
  const voiceReady = providers?.voice !== false;
  const canStart = consented && (!siteKey || turnstileToken) && phase !== "starting" && voiceReady;

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
  const subtitle = props.subtitle ?? config.company.name;

  if (phase === "live" && conn) {
    return (
      <LiveKitRoom serverUrl={conn.serverUrl} token={conn.token} connect audio video={false} className="flex min-h-0 flex-1 flex-col" onError={(e) => setError(e.message)}>
        <RoomAudioRenderer />
        <LiveCall
          speaker={speaker}
          contentWarning={contentWarning}
          maxSeconds={conn.maxSeconds}
          onTick={(d) => onLive({ ...d, combo: conn.combo, sessionId: conn.sessionId })}
          onEnded={handleEnded}
          onError={setError}
          error={error}
        />
      </LiveKitRoom>
    );
  }

  const status =
    phase === "starting" ? "Bağlanıyor…" : phase === "ended" ? "Görüşme bitti" : !voiceReady ? "Sesli mod sunucuda yapılandırılmamış" : subtitle || "Aramaya hazır";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Hero speaker={speaker} status={status} contentWarning={contentWarning} />
        {lastLines.length > 0 ? (
          <Transcript speaker={speaker} lines={lastLines} turns={lastTurns} />
        ) : (
          <p className="mx-auto max-w-[30rem] px-6 text-center text-[14px] leading-[21px] text-secondary">
            {config.greeting ? <>Aradığınızda “{config.greeting}” diye açacak. </> : null}
            Müşteri gibi konuşun; konuşma burada yazıya dökülür ve her cevabın kaç milisaniyede geldiği altında görünür.
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pb-6 pt-4">
        {error && <Banner tone="error">{error}</Banner>}
        {!consented && (
          <div className="flex w-full max-w-[26rem] items-start gap-3 rounded-[12px] bg-surface-2 px-4 py-3">
            <p className="flex-1 text-[13px] leading-[18px] text-secondary">
              Sesiniz yazıya çevrilip yapay zekâ sağlayıcılarına iletilir; transkript birkaç gün sonra silinir. Gerçek kişisel bilgi, kart veya şifre söylemeyin.
            </p>
            <Switch label="Onaylıyorum" checked={consent} onChange={setConsent} />
          </div>
        )}
        {siteKey && consented && !turnstileToken && <Turnstile siteKey={siteKey} onToken={setTurnstileToken} />}
        <RoundButton
          label={phase === "starting" ? "Bağlanıyor" : phase === "ended" ? "Tekrar ara" : "Ara"}
          tone="call"
          onClick={start}
          disabled={!canStart}
          pulse={canStart === true && phase === "idle"}
        >
          <IconPhone size={28} />
        </RoundButton>
        <p className="text-[12px] text-tertiary">Mikrofon izni istenir. Görüşme en fazla 3 dakika sürer.</p>
      </div>
    </div>
  );
}

function Hero({
  speaker,
  status,
  contentWarning,
  level,
  micLevel,
  tone,
}: {
  speaker: string;
  status: React.ReactNode;
  contentWarning: boolean;
  level?: number;
  micLevel?: number;
  tone?: "rest" | "speaking" | "listening" | "thinking";
}) {
  return (
    <div className="flex flex-col items-center px-4 pb-6 pt-8 sm:pt-12">
      <VuDial level={level} micLevel={micLevel} tone={tone} size={240} />
      <h2 className="mt-3 text-center text-[24px] font-bold leading-[30px] tracking-[-0.02em]">{speaker}</h2>
      <p className="mt-0.5 text-center text-[15px] tabular-nums text-secondary" aria-live="polite">
        {status}
      </p>
      {contentWarning && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-needle-soft px-2.5 py-0.5 text-[12px] font-medium text-needle-ink">
          <IconWarn size={13} /> Argo veya sert dil içerebilir
        </span>
      )}
    </div>
  );
}

function Transcript({ speaker, lines, turns }: { speaker: string; lines: TranscriptLine[]; turns: TurnLatency[] }) {
  let agentIdx = -1;
  return (
    <ol className="mx-auto flex max-w-[36rem] flex-col gap-2 px-4 pb-6" aria-label="Transkript">
      {lines.map((l, i) => {
        const isAgent = l.role === "assistant";
        if (isAgent) agentIdx++;
        const latency = isAgent ? turns[agentIdx] : undefined;
        const firstOfRun = i === 0 || lines[i - 1].role !== l.role;
        return (
          <li key={l.id} className={`flex flex-col ${isAgent ? "items-start" : "items-end"} ${firstOfRun && i > 0 ? "mt-2" : ""}`} style={{ animation: "rise 220ms ease-out" }}>
            {firstOfRun && <span className="mb-0.5 px-3 text-[11px] text-secondary">{isAgent ? speaker : "Siz"}</span>}
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-[18px] px-3.5 py-2 text-[15px] leading-[21px] ${
                isAgent ? "rounded-bl-[6px] bg-fill text-label" : "rounded-br-[6px] bg-label text-surface"
              } ${l.final ? "" : "opacity-60"}`}
            >
              {l.text}
            </p>
            {latency && <LatencyStrip latency={latency} />}
          </li>
        );
      })}
    </ol>
  );
}

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`flex max-w-[30rem] items-start gap-2 rounded-[12px] px-3.5 py-2.5 text-[13px] leading-[18px] ${tone === "error" ? "bg-end-soft text-end" : "bg-needle-soft text-needle-ink"}`}>
      <IconWarn size={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function RoundButton({
  label,
  tone,
  onClick,
  disabled,
  pulse,
  pressed,
  children,
}: {
  label: string;
  tone: "call" | "end" | "neutral";
  onClick: () => void;
  disabled?: boolean;
  pulse?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  const bg = tone === "call" ? "bg-call text-white" : tone === "end" ? "bg-end text-white" : pressed ? "bg-label text-surface" : "bg-fill-strong text-label";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={tone === "neutral" ? pressed : undefined}
        className={`grid size-[64px] place-items-center rounded-full ${bg} shadow-float transition-[transform,opacity] active:scale-95 disabled:opacity-35`}
        style={pulse ? { animation: "ring 1.6s ease-out infinite" } : undefined}
      >
        {children}
      </button>
      <span className="text-[12px] text-secondary">{label}</span>
    </div>
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
  contentWarning,
  maxSeconds,
  onTick,
  onEnded,
  onError,
  error,
}: {
  speaker: string;
  contentWarning: boolean;
  maxSeconds: number;
  onTick: (d: { lines: TranscriptLine[]; turns: TurnLatency[]; elapsed: number }) => void;
  onEnded: (r: { lines: TranscriptLine[]; turns: TurnLatency[]; durationSec: number }) => void;
  onError: (m: string | null) => void;
  error: string | null;
}) {
  const room = useRoomContext();
  const { state, agent, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const agentLevel = useTrackVolume(audioTrack);
  const micLevel = useTrackVolume(microphoneTrack?.track as LocalAudioTrack | undefined);
  const streams = useTranscriptions();
  const [turns, setTurns] = useState<TurnLatency[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const endedRef = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

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
  const tone = state === "speaking" ? "speaking" : state === "listening" ? "listening" : state === "thinking" ? "thinking" : "rest";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Hero
          speaker={speaker}
          contentWarning={contentWarning}
          level={state === "speaking" ? agentLevel : 0}
          micLevel={isMicrophoneEnabled ? micLevel : 0}
          tone={tone}
          status={
            <>
              {STATE_LABEL[state] ?? state}
              <span className="mx-1.5 text-tertiary">·</span>
              <span title="Kalan süre">{mmss(remaining)}</span>
            </>
          }
        />
        <Transcript speaker={speaker} lines={lines} turns={turns} />
      </div>
      <div className="flex flex-col items-center gap-4 px-4 pb-6 pt-4">
        {(error || notice) && <Banner tone={error ? "error" : "info"}>{error ?? notice}</Banner>}
        <div className="flex items-start gap-10">
          <RoundButton label={isMicrophoneEnabled ? "Sessize al" : "Sesi aç"} tone="neutral" pressed={!isMicrophoneEnabled} onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}>
            {isMicrophoneEnabled ? <IconMic size={26} /> : <IconMicOff size={26} />}
          </RoundButton>
          <RoundButton label="Bitir" tone="end" onClick={end}>
            <IconPhoneDown size={30} />
          </RoundButton>
        </div>
      </div>
    </div>
  );
}
