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
import { MicrophoneIcon, MicrophoneSlashIcon, PhoneDisconnectIcon, WarningIcon } from "@phosphor-icons/react";
import type { AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import type { RoomMessage, TranscriptLine, TurnLatency, VoiceStartResponse } from "@/lib/client/types";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Turnstile } from "../Turnstile";
import { auraColor, useThemeMode } from "./useThemeMode";

const CONSENT_KEY = "vap.voiceConsent.v1";
const noopSubscribe = () => () => {};
const readConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
};

export interface CallResult {
  sessionId: string;
  lines: TranscriptLine[];
  turns: TurnLatency[];
  combo: VoiceStartResponse["combo"];
  durationSec: number;
}

export interface CallSummary extends CallResult {
  costUsd: number | null;
}

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}
export const fmtUsd = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * The whole home screen: the agent's aura in the middle, one button to call, the spoken
 * conversation as captions underneath. No text input anywhere: you talk, it talks back.
 */
export function TalkStage(props: {
  config: AgentConfig;
  ensureSaved: () => Promise<string | null>;
  providers: ProviderAvailability | null;
  providerOverride: Partial<AgentConfig["providers"]>;
  perMinuteUsd: number;
  contentWarning: boolean;
  last: CallSummary | null;
  onLiveChange: (live: boolean) => void;
  onEnded: (r: CallResult) => void;
}) {
  const { config, ensureSaved, providers, providerOverride, onEnded, onLiveChange } = props;
  const [phase, setPhase] = useState<"idle" | "starting" | "live">("idle");
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const storedConsent = useSyncExternalStore(noopSubscribe, readConsent, () => false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [conn, setConn] = useState<VoiceStartResponse | null>(null);
  const theme = useThemeMode();

  const siteKey = providers?.turnstileSiteKey ?? null;
  const consented = consent || storedConsent;
  const voiceReady = providers?.voice !== false;
  const canStart = consented && (!siteKey || turnstileToken) && phase === "idle" && voiceReady;

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
    setConn(j as VoiceStartResponse);
    setPhase("live");
    onLiveChange(true);
  }

  const handleEnded = useCallback(
    (r: Omit<CallResult, "sessionId" | "combo">) => {
      if (!conn) return;
      onEnded({ ...r, sessionId: conn.sessionId, combo: conn.combo });
      setConn(null);
      setPhase("idle");
      onLiveChange(false);
    },
    [conn, onEnded, onLiveChange],
  );

  const speaker = config.name || "Agent";

  if (phase === "live" && conn) {
    return (
      <LiveKitRoom serverUrl={conn.serverUrl} token={conn.token} connect audio video={false} className="flex min-h-0 flex-1 flex-col" onError={(e) => setError(e.message)}>
        <RoomAudioRenderer />
        <LiveCall speaker={speaker} maxSeconds={conn.maxSeconds} theme={theme} onEnded={handleEnded} onError={setError} error={error} />
      </LiveKitRoom>
    );
  }

  const last = props.last;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-8">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center pt-4 text-center">
        <AgentAudioVisualizerAura
          size="lg"
          state={phase === "starting" ? "connecting" : "idle"}
          color={auraColor(theme)}
          themeMode={theme}
          className="size-[min(60vw,240px)] [mask-image:radial-gradient(closest-side,black_70%,transparent)] sm:size-[280px]"
        />
        <h1 className="mt-6 text-balance text-2xl font-semibold tracking-tight">{speaker}</h1>
        <p className="mt-1.5 max-w-sm text-pretty text-sm leading-6 text-muted-foreground">
          {!voiceReady
            ? "Sunucuda LiveKit ayarları eksik; sesli görüşme başlatılamıyor."
            : config.greeting
              ? `“${config.greeting}”`
              : config.company.name || "Mikrofona konuşarak deneyin."}
        </p>
        {props.contentWarning && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn-ink">
            <WarningIcon size={12} weight="bold" /> argo içerebilir
          </p>
        )}

        {last && <LastCall last={last} speaker={speaker} />}

        <div className="mt-8 flex w-full flex-col items-center gap-3">
          {error && (
            <p role="alert" className="flex w-full items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-left text-sm leading-5 text-destructive">
              <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          {!consented && (
            <label className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-left">
              <input type="checkbox" className="mt-[3px] size-4 shrink-0 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-xs leading-5 text-muted-foreground">
                Sesimin yazıya çevrilip yapay zekâ sağlayıcılarına iletilmesini onaylıyorum. Transkript birkaç gün sonra silinir; gerçek kişisel bilgi, kart veya şifre söylemeyeceğim.
              </span>
            </label>
          )}
          {siteKey && consented && !turnstileToken && <Turnstile siteKey={siteKey} onToken={setTurnstileToken} />}
          <Button size="lg" onClick={start} disabled={!canStart} className="h-12 w-64 rounded-full font-mono text-xs font-bold tracking-wider uppercase">
            {phase === "starting" ? "Bağlanıyor…" : last ? "Tekrar konuş" : "Konuşmaya başla"}
          </Button>
          <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            ~{fmtUsd(props.perMinuteUsd)}/dk · en fazla 3 dk
          </p>
        </div>
      </div>
    </div>
  );
}

function avgFirstAudio(turns: TurnLatency[]) {
  const t = turns.filter((x) => (x.eou ?? 0) > 0 && x.first_audio);
  return t.length ? t.reduce((a, x) => a + (x.first_audio ?? 0), 0) / t.length : null;
}

/** After a call: one line of numbers, the transcript on demand, JSON export. */
function LastCall({ last, speaker }: { last: CallSummary; speaker: string }) {
  const [open, setOpen] = useState(false);
  const download = () => {
    const data = {
      agent: speaker,
      sessionId: last.sessionId,
      combo: last.combo,
      durationSec: Math.round(last.durationSec),
      estCostUsd: last.costUsd,
      exportedAt: new Date().toISOString(),
      transcript: last.lines.map((l) => ({ role: l.role, text: l.text })),
      turnLatencyMs: last.turns,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${last.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const stats: [string, string][] = [
    ["Süre", mmss(last.durationSec)],
    ["Ort. ilk ses", fmtMs(avgFirstAudio(last.turns))],
    ["Maliyet", last.costUsd != null ? fmtUsd(last.costUsd) : "hesaplanıyor"],
  ];
  return (
    <div className="mt-6 w-full rounded-xl border border-border bg-card text-left">
      <dl className="grid grid-cols-3 divide-x divide-border">
        {stats.map(([k, v]) => (
          <div key={k} className="px-3 py-2.5">
            <dt className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{k}</dt>
            <dd className="mt-0.5 font-mono text-sm font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <button className="btn-text px-0 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={last.lines.length === 0}>
          {last.lines.length === 0 ? "Konuşma olmadı" : open ? "Transkripti gizle" : "Transkripti göster"}
        </button>
        <button className="btn-text px-0 text-xs" onClick={download}>
          JSON indir
        </button>
      </div>
      {open && (
        <div className="max-h-72 overflow-y-auto border-t border-border px-3 py-3">
          <Transcript lines={last.lines} turns={last.turns} realtime={last.combo.mode === "realtime"} />
        </div>
      )}
    </div>
  );
}

/** Captions: the agent on the left in plain text, you on the right in a soft bubble. */
function Transcript({ lines, turns, realtime }: { lines: TranscriptLine[]; turns: TurnLatency[]; realtime: boolean }) {
  let agentIdx = -1;
  return (
    <ol className="space-y-4" aria-label="Transkript">
      {lines.map((l) => {
        const isAgent = l.role === "assistant";
        if (isAgent) agentIdx++;
        const lat = isAgent ? turns[agentIdx] : undefined;
        return (
          <li key={l.id} className={cn("flex flex-col", isAgent ? "items-start" : "items-end")} style={{ animation: "rise 200ms ease-out" }}>
            <p
              className={cn(
                "max-w-[85%] text-[15px] leading-6 whitespace-pre-wrap",
                isAgent ? "text-foreground" : "rounded-2xl bg-muted px-4 py-2 text-foreground",
                !l.final && "opacity-60",
              )}
            >
              {l.text}
            </p>
            {lat && <Latency lat={lat} realtime={realtime} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Per-reply latency: you stopped talking → first audio, split into STT / LLM / TTS. */
function Latency({ lat, realtime }: { lat: TurnLatency; realtime: boolean }) {
  const parts = realtime
    ? []
    : ([
        ["STT", lat.eou, "var(--stt)"],
        ["LLM", lat.llm_first_token, "var(--llm)"],
        ["TTS", lat.tts_first_audio, "var(--tts)"],
      ] as const).filter(([, v]) => typeof v === "number" && v > 0);
  const total = lat.first_audio ?? parts.reduce((a, [, v]) => a + (v ?? 0), 0);
  if (!total) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2.5 font-mono text-[10.5px] tracking-wide text-muted-foreground uppercase" title="Sustuğunuz andan agent'ın ilk sesine kadar">
      <span className="font-bold text-foreground">{fmtMs(total)}</span>
      {parts.map(([k, v, c]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full" style={{ background: c }} aria-hidden />
          {k} {fmtMs(v)}
        </span>
      ))}
    </p>
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
  theme,
  onEnded,
  onError,
  error,
}: {
  speaker: string;
  maxSeconds: number;
  theme: "dark" | "light";
  onEnded: (r: { lines: TranscriptLine[]; turns: TurnLatency[]; durationSec: number }) => void;
  onError: (m: string | null) => void;
  error: string | null;
}) {
  const room = useRoomContext();
  const { state, agent, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
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
  }, [lines, turns]);

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
  const hasLines = lines.length > 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center">
      <div className={cn("flex shrink-0 flex-col items-center transition-[padding] duration-500", hasLines ? "pt-2" : "flex-1 justify-center")}>
        <AgentAudioVisualizerAura
          size="lg"
          state={state}
          audioTrack={audioTrack}
          color={auraColor(theme)}
          themeMode={theme}
          className={cn("transition-[width,height] duration-500 [mask-image:radial-gradient(closest-side,black_70%,transparent)]", hasLines ? "size-[120px] sm:size-[160px]" : "size-[min(64vw,260px)] sm:size-[300px]")}
        />
        <p className="mt-3 font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase" role="status">
          {speaker} · {STATE_LABEL[state] ?? state}
        </p>
      </div>

      {hasLines && (
        <div
          ref={scroller}
          aria-live="polite"
          className="min-h-0 w-full max-w-xl flex-1 overflow-y-auto px-4 pt-6 pb-36 [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]"
        >
          <Transcript lines={lines} turns={turns} realtime={false} />
        </div>
      )}

      {/* control bar (Agent Starter style): mic, timer, end */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pt-10 pb-5">
        {(error || notice) && (
          <p role={error ? "alert" : "status"} className={cn("flex max-w-md items-start gap-2 rounded-lg px-3.5 py-2 text-sm leading-5", error ? "bg-danger-soft text-destructive" : "bg-warn-soft text-warn-ink")}>
            <WarningIcon size={16} weight="bold" className="mt-0.5 shrink-0" />
            {error ?? notice}
          </p>
        )}
        <div className="flex items-center gap-2 rounded-[31px] border border-input/50 bg-background p-2 shadow-[0_8px_30px_-10px_rgb(0_0_0/0.25)] dark:border-muted">
          <Button
            variant={isMicrophoneEnabled ? "secondary" : "outline"}
            size="lg"
            className="h-11 gap-2 rounded-full px-4"
            aria-pressed={!isMicrophoneEnabled}
            aria-label={isMicrophoneEnabled ? "Sessize al" : "Mikrofonu aç"}
            onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          >
            {isMicrophoneEnabled ? <MicrophoneIcon size={18} weight="bold" /> : <MicrophoneSlashIcon size={18} weight="bold" className="text-destructive" />}
            <MicBars level={isMicrophoneEnabled ? micLevel : 0} />
          </Button>
          <span className="w-14 text-center font-mono text-xs font-bold tabular-nums text-muted-foreground" title="Kalan süre">
            {mmss(remaining)}
          </span>
          <Button variant="destructive" size="lg" className="h-11 gap-2 rounded-full px-5 font-mono text-xs font-bold tracking-wider uppercase" onClick={end}>
            <PhoneDisconnectIcon size={18} weight="bold" />
            Bitir
          </Button>
        </div>
      </div>
    </div>
  );
}

function MicBars({ level }: { level: number }) {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden>
      {[0.6, 1, 0.75].map((k, i) => (
        <span key={i} className="w-[3px] rounded-full bg-current transition-[height] duration-75" style={{ height: `${Math.max(3, Math.min(16, level * 40 * k))}px` }} />
      ))}
    </span>
  );
}
