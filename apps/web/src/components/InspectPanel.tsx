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

/** The rack: readouts on a small LCD, then model selection and the request log. */
export function InspectPanel({
  call,
  providers,
  agentName,
  nextCombo,
  onNextCombo,
  language,
  sampleText,
}: {
  call: CallView | null;
  providers: ProviderAvailability | null;
  agentName: string;
  nextCombo: ProviderSelection;
  onNextCombo: (v: ProviderSelection) => void;
  language: string;
  sampleText: string;
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
    const link = document.createElement("a");
    link.href = url;
    link.download = `${call.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const c = call?.combo;
  const dur = call ? `${Math.floor(call.seconds / 60)}:${String(Math.floor(call.seconds % 60)).padStart(2, "0")}` : "-:--";

  return (
    <div className="space-y-6 p-4">
      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h3 className="text-[13px] font-semibold lowercase text-faint">{call?.live ? "bu görüşme" : "son görüşme"}</h3>
          <button onClick={download} disabled={!call} className="text-[12px] font-semibold lowercase text-signal-ink hover:underline disabled:text-dim disabled:no-underline">
            json indir
          </button>
        </div>
        <div className="bezel p-[7px]">
          <dl className="lcd grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5">
            <Readout k="ilk ses" v={fmtMs(avgFirst)} big />
            <Readout k="süre" v={dur} big />
            <Readout k="cevap" v={call ? String(call.lines.filter((l) => l.role === "assistant").length) : "-"} />
            <Readout k="maliyet" v={call?.costUsd != null ? `$${call.costUsd.toFixed(4)}` : call?.live ? "bitince" : "-"} />
          </dl>
        </div>
        {c && (
          <dl className="mt-3 space-y-1 px-1 text-[13px]">
            {c.mode === "realtime" ? (
              <KV k="realtime" v={label(providers?.realtime, c.realtime)} />
            ) : (
              <>
                <KV k="stt" v={label(providers?.stt, c.stt)} />
                <KV k="llm" v={label(providers?.llm, c.llm)} />
                <KV k="tts" v={label(providers?.tts, c.tts)} />
                {c.voice && <KV k="ses" v={c.voice_label ?? label(providers?.tts.find((t) => t.id === c.tts)?.voices, c.voice)} />}
              </>
            )}
          </dl>
        )}
        <p className="group-foot">İlk ses: konuşmanız bittikten sonra agent'ın ilk sesine kadar geçen süre.</p>
      </section>

      <section>
        <h3 className="group-title">başka modellerle dene</h3>
        {providers ? <ModelPicker compact idPrefix="next" language={language} sampleText={sampleText} value={nextCombo} providers={providers} onChange={onNextCombo} /> : null}
        <p className="group-foot">Aynı agent, sonraki aramada bu kombinasyonla açılır.</p>
      </section>

      <section>
        <h3 className="group-title">istek logu</h3>
        <div className="well rounded-[8px] px-3.5 py-4 font-mono text-[12px] leading-[18px] text-faint">
          Agent bir işlem tetiklediğinde istek burada simüle edilir; hiçbir gerçek sisteme gönderilmez.
        </div>
      </section>
    </div>
  );
}

function Readout({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold lowercase text-lcd-dim">{k}</dt>
      <dd className={`lcd-num mt-1 leading-none ${big ? "text-[26px]" : "text-[19px]"}`}>{v}</dd>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-14 shrink-0 font-semibold lowercase text-faint">{k}</dt>
      <dd className="truncate">{v}</dd>
    </div>
  );
}
