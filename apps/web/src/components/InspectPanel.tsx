"use client";

import type { ProviderSelection } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import type { TranscriptLine, TurnLatency, VoiceStartResponse } from "@/lib/client/types";
import { fmtMs } from "./LatencyStrip";
import { ModelPicker } from "./ModelPicker";

export interface CallView {
  sessionId: string;
  lines: TranscriptLine[];
  turns: TurnLatency[];
  seconds: number;
  combo: VoiceStartResponse["combo"];
  costUsd: number | null;
  live: boolean;
}

export function InspectPanel({
  call,
  providers,
  agentName,
  nextCombo,
  onNextCombo,
}: {
  call: CallView | null;
  providers: ProviderAvailability | null;
  agentName: string;
  nextCombo: ProviderSelection;
  onNextCombo: (v: ProviderSelection) => void;
}) {
  const userTurns = call?.turns.filter((t) => (t.eou ?? 0) > 0) ?? [];
  const avgFirst = userTurns.length ? userTurns.reduce((a, t) => a + (t.first_audio ?? 0), 0) / userTurns.length : null;
  const label = (list: { id: string; label: string }[] | undefined, id: string) => list?.find((m) => m.id === id)?.label ?? id;

  const download = () => {
    if (!call) return;
    const data = {
      agent: agentName,
      sessionId: call.sessionId,
      combo: call.combo,
      durationSec: Math.round(call.seconds),
      estCostUsd: call.costUsd,
      exportedAt: new Date().toISOString(),
      transcript: call.lines.map((l) => ({ role: l.role, text: l.text })),
      turnLatencyMs: call.turns,
      requests: [],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${call.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const c = call?.combo;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto text-console-text">
      <div className="border-b border-console-line px-4 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-bold text-white">{call?.live ? "Bu görüşme (canlı)" : "Son görüşme"}</h2>
          <button onClick={download} disabled={!call} className="text-[13px] text-console-text/80 underline-offset-2 hover:text-white hover:underline disabled:opacity-40">
            JSON indir
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <Metric label="Ort. ilk ses" value={fmtMs(avgFirst)} hint="Konuşmanız bittikten sonra ilk sese kadar" />
          <Metric label="Süre" value={call ? `${Math.floor(call.seconds / 60)}:${String(Math.floor(call.seconds % 60)).padStart(2, "0")}` : "—"} />
          <Metric label="Cevap" value={call ? String(call.lines.filter((l) => l.role === "assistant").length) : "—"} />
          <Metric label="Tahmini maliyet" value={call?.costUsd != null ? `$${call.costUsd.toFixed(4)}` : call?.live ? "bitince" : "—"} />
        </dl>
        {c && (
          <ul className="mt-3 space-y-0.5 text-[13px] text-console-text/85">
            {c.mode === "realtime" ? (
              <li>Realtime: <span className="text-white">{label(providers?.realtime, c.realtime)}</span></li>
            ) : (
              <>
                <li>STT: <span className="text-white">{label(providers?.stt, c.stt)}</span></li>
                <li>LLM: <span className="text-white">{label(providers?.llm, c.llm)}</span></li>
                <li>
                  TTS: <span className="text-white">{label(providers?.tts, c.tts)}</span>
                  {c.voice ? <>, ses {label(providers?.tts.find((t) => t.id === c.tts)?.voices, c.voice)}</> : null}
                </li>
              </>
            )}
          </ul>
        )}
      </div>

      <div className="border-b border-console-line px-4 py-3">
        <h2 className="text-[15px] font-bold text-white">Başka modellerle dene</h2>
        <p className="mb-3 mt-0.5 text-[13px] text-console-text/75">Aynı agent, sonraki görüşmede bu kombinasyonla açılır.</p>
        {providers ? <ModelPicker idPrefix="next" tone="dark" value={nextCombo} providers={providers} onChange={onNextCombo} /> : null}
      </div>

      <div className="px-4 pb-4 pt-3">
        <h2 className="mb-2 text-[15px] font-bold text-white">İstek logu</h2>
        <p className="rounded-[var(--radius-field)] border border-dashed border-console-line px-3 py-4 text-[13px] leading-5 text-console-text/75">
          Agent bir işlem tetiklediğinde istek burada simüle edilerek listelenir; hiçbir gerçek sisteme gönderilmez.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-[12px] text-console-text/70">{label}</dt>
      <dd className="mt-0.5 font-mono text-[17px] tabular-nums text-white">{value}</dd>
    </div>
  );
}
