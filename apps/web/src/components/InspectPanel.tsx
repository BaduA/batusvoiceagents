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
  const dur = call ? `${Math.floor(call.seconds / 60)}:${String(Math.floor(call.seconds % 60)).padStart(2, "0")}` : "—";

  return (
    <div className="space-y-6 px-3 py-4">
      <section>
        <div className="mb-1.5 flex items-baseline justify-between px-3">
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-secondary">
            {call?.live && <span className="size-1.5 rounded-full bg-end" aria-hidden />}
            {call?.live ? "Bu görüşme" : "Son görüşme"}
          </h3>
          <button onClick={download} disabled={!call} className="text-[12px] font-medium text-needle-ink hover:underline disabled:text-tertiary disabled:no-underline">
            JSON indir
          </button>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] bg-separator">
          <Stat label="Ort. ilk ses" value={fmtMs(avgFirst)} accent />
          <Stat label="Süre" value={dur} />
          <Stat label="Cevap" value={call ? String(call.lines.filter((l) => l.role === "assistant").length) : "—"} />
          <Stat label="Tahmini maliyet" value={call?.costUsd != null ? `$${call.costUsd.toFixed(4)}` : call?.live ? "bitince" : "—"} />
        </div>
        {c && (
          <div className="group-list mt-2 text-[13px]">
            {c.mode === "realtime" ? (
              <KV k="Realtime" v={label(providers?.realtime, c.realtime)} />
            ) : (
              <>
                <KV k="STT" v={label(providers?.stt, c.stt)} />
                <KV k="LLM" v={label(providers?.llm, c.llm)} />
                <KV k="TTS" v={label(providers?.tts, c.tts)} />
                {c.voice && <KV k="Ses" v={label(providers?.tts.find((t) => t.id === c.tts)?.voices, c.voice)} />}
              </>
            )}
          </div>
        )}
        <p className="group-foot">İlk ses: konuşmanız bittikten sonra agent'ın ilk sesine kadar geçen süre.</p>
      </section>

      <section>
        <h3 className="group-title">Başka modellerle dene</h3>
        {providers ? <ModelPicker compact idPrefix="next" value={nextCombo} providers={providers} onChange={onNextCombo} /> : null}
        <p className="group-foot">Aynı agent, sonraki aramada bu kombinasyonla açılır.</p>
      </section>

      <section>
        <h3 className="group-title">İstek logu</h3>
        <div className="rounded-[10px] bg-code-bg px-3.5 py-4 font-mono text-[12px] leading-[18px] text-code-text/60">
          Agent bir işlem tetiklediğinde istek burada simüle edilir; hiçbir gerçek sisteme gönderilmez.
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <div className="text-[11px] text-secondary">{label}</div>
      <div className={`mt-0.5 text-[19px] font-semibold tabular-nums tracking-[-0.01em] ${accent ? "text-needle-ink" : ""}`}>{value}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <span className="text-secondary">{k}</span>
      <span className="ml-auto truncate text-right">{v}</span>
    </div>
  );
}
