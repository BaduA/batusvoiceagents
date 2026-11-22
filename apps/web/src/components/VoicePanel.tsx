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
import { LevelMeter } from "./ui/LevelMeter";
import { Switch } from "./ui/Switch";
import { IconMic, IconMicOff, IconWarn } from "./ui/icons";

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
          subtitle={subtitle}
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

  const status = phase === "starting" ? "bağlanıyor" : phase === "ended" ? "bitti" : !voiceReady ? "kapalı" : "hazır";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Screen speaker={speaker} subtitle={subtitle} status={status} blink={phase === "starting"} contentWarning={contentWarning}>
        {lastLines.length > 0 ? (
          <Transcript speaker={speaker} lines={lastLines} turns={lastTurns} />
        ) : (
          <div className="max-w-[34rem] space-y-3 text-[15px] leading-[22px]">
            {!voiceReady ? (
              <p>Sesli mod sunucuda yapılandırılmamış: LiveKit ayarları eksik.</p>
            ) : (
              <>
                {config.greeting && (
                  <p>
                    <span className="text-lcd-dim">açılış › </span>“{config.greeting}”
                  </p>
                )}
                <p className="text-lcd-dim">Turuncu tuşa basın ve müşteri gibi konuşun. Konuşma bu ekrana yazılır; her cevabın altında ilk sesin kaç milisaniyede geldiği görünür.</p>
              </>
            )}
          </div>
        )}
      </Screen>

      <div className="flex flex-col items-center gap-3">
        {error && <Notice tone="error">{error}</Notice>}
        {!consented && (
          <label className="plate flex w-full max-w-[30rem] items-start gap-3 px-4 py-3">
            <span className="flex-1 text-[13px] leading-[18px] text-faint">
              Sesim yazıya çevrilip yapay zekâ sağlayıcılarına iletilecek, transkript birkaç gün sonra silinecek. Gerçek kişisel bilgi, kart veya şifre söylemeyeceğim.
            </span>
            <Switch label="Onaylıyorum" checked={consent} onChange={setConsent} />
          </label>
        )}
        {siteKey && consented && !turnstileToken && <Turnstile siteKey={siteKey} onToken={setTurnstileToken} />}
        <TalkKey label={phase === "starting" ? "bağlanıyor" : phase === "ended" ? "tekrar ara" : "ara"} onClick={start} disabled={!canStart} />
        <p className="text-[12px] text-faint">Mikrofon izni istenir. Görüşme en fazla 3 dakika.</p>
      </div>
    </div>
  );
}

/** The LCD: bezel, glass, header line (name + status), then content. */
function Screen({
  speaker,
  subtitle,
  status,
  blink,
  live,
  contentWarning,
  meters,
  children,
  scrollRef,
}: {
  speaker: string;
  subtitle?: string;
  status: React.ReactNode;
  blink?: boolean;
  live?: boolean;
  contentWarning: boolean;
  meters?: React.ReactNode;
  children: React.ReactNode;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className="bezel flex min-h-[18rem] flex-1 flex-col" style={{ animation: "boot 400ms ease-out" }}>
      <div className="lcd flex min-h-0 flex-1 flex-col">
        <div className="flex items-start gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="stamp truncate text-[22px] leading-[26px]">{speaker}</h2>
            <p className="truncate text-[13px] text-lcd-dim">
              {subtitle || "demo agent"}
              {contentWarning ? ", argo içerebilir" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {live && <span className="size-2.5 rounded-full bg-signal" style={{ animation: "blink 1.2s steps(1) infinite" }} aria-hidden />}
            <span className="lcd-num text-[22px] leading-none" style={blink ? { animation: "blink 0.9s steps(1) infinite" } : undefined}>
              {status}
            </span>
          </div>
        </div>
        {meters && <div className="space-y-1.5 px-5 pb-3">{meters}</div>}
        <div className="mx-5 h-px bg-lcd-ink/20" />
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          {children}
        </div>
      </div>
    </div>
  );
}

function Transcript({ speaker, lines, turns }: { speaker: string; lines: TranscriptLine[]; turns: TurnLatency[] }) {
  let agentIdx = -1;
  return (
    <ol className="space-y-3" aria-label="Transkript">
      {lines.map((l) => {
        const isAgent = l.role === "assistant";
        if (isAgent) agentIdx++;
        const latency = isAgent ? turns[agentIdx] : undefined;
        return (
          <li key={l.id} className="grid grid-cols-[4.2rem_minmax(0,1fr)] gap-3" style={{ animation: "rise 180ms ease-out" }}>
            <span className="truncate pt-[3px] text-[12px] font-semibold lowercase text-lcd-dim">{isAgent ? speaker.split(" ")[0] : "siz"}</span>
            <div>
              <p className={`whitespace-pre-wrap text-[15.5px] leading-[22px] ${isAgent ? "font-medium" : ""} ${l.final ? "" : "opacity-60"}`}>{l.text}</p>
              {latency && <LatencyStrip latency={latency} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Notice({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`flex max-w-[34rem] items-start gap-2 rounded-[8px] px-3.5 py-2.5 text-left text-[13px] leading-[18px] ${tone === "error" ? "bg-fault-soft text-fault" : "bg-signal-soft text-signal-ink"}`}
    >
      <IconWarn size={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** The one saturated thing on screen: a round signal-orange key set in a recessed ring. */
function TalkKey({ label, onClick, disabled, live }: { label: string; onClick: () => void; disabled?: boolean; live?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="grid size-[84px] place-items-center rounded-full bg-signal text-white transition-transform active:translate-y-[2px] disabled:cursor-not-allowed disabled:saturate-[0.35] disabled:opacity-70"
        style={{
          boxShadow:
            "0 0 0 7px var(--well), 0 0 0 8px var(--groove-dark), inset 0 2px 0 rgb(255 255 255 / 0.35), inset 0 -4px 0 rgb(0 0 0 / 0.18), 0 3px 0 var(--key-lo)",
        }}
      >
        {live ? <span className="size-6 rounded-[4px] bg-white" /> : <IconMic size={30} />}
      </button>
      <span className="text-[13px] font-semibold lowercase">{label}</span>
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  connecting: "bağlanıyor",
  initializing: "hazırlanıyor",
  "pre-connect-buffering": "hazırlanıyor",
  listening: "dinliyor",
  thinking: "düşünüyor",
  speaking: "konuşuyor",
  idle: "bekliyor",
  disconnected: "kapandı",
  failed: "hata",
};

function LiveCall({
  speaker,
  subtitle,
  contentWarning,
  maxSeconds,
  onTick,
  onEnded,
  onError,
  error,
}: {
  speaker: string;
  subtitle?: string;
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Screen
        speaker={speaker}
        subtitle={subtitle}
        contentWarning={contentWarning}
        live
        scrollRef={scroller}
        status={
          <>
            <span className="mr-3 text-[16px]">{STATE_LABEL[state] ?? state}</span>
            <span title="Kalan süre">{mmss(remaining)}</span>
          </>
        }
        meters={
          <>
            <LevelMeter label="agent" level={state === "speaking" ? agentLevel : 0} />
            <LevelMeter label="siz" level={isMicrophoneEnabled ? micLevel : 0} />
          </>
        }
      >
        {lines.length === 0 ? <p className="text-lcd-dim">Agent hazırlanıyor, birazdan konuşmaya başlayacak…</p> : <Transcript speaker={speaker} lines={lines} turns={turns} />}
      </Screen>

      <div className="flex flex-col items-center gap-3">
        {(error || notice) && <Notice tone={error ? "error" : "info"}>{error ?? notice}</Notice>}
        <div className="flex items-start gap-8">
          <div className="flex flex-col items-center gap-2 pt-5">
            <button
              type="button"
              className="key size-[52px] rounded-full"
              aria-pressed={!isMicrophoneEnabled}
              aria-label={isMicrophoneEnabled ? "Sessize al" : "Mikrofonu aç"}
              onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            >
              {isMicrophoneEnabled ? <IconMic size={22} /> : <IconMicOff size={22} />}
            </button>
            <span className="text-[12px] lowercase text-faint">{isMicrophoneEnabled ? "sessiz" : "sesi aç"}</span>
          </div>
          <TalkKey label="bitir" onClick={end} live />
          <div className="w-[52px]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
