import type { TurnLatency } from "@/lib/client/types";

const SCALE_MS = 2500;

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}

/**
 * The per-turn latency bar, drawn to scale (full width = 2.5 s):
 * end of user speech → turn committed (incl. STT) → LLM first token → TTS first audio.
 */
export function LatencyStrip({ latency }: { latency: TurnLatency }) {
  const segs = [
    { key: "eou", ms: latency.eou, cls: "bg-graphite", label: "Konuşma sonu" },
    { key: "llm", ms: latency.llm_first_token, cls: "bg-needle", label: "LLM" },
    { key: "tts", ms: latency.tts_first_audio, cls: "bg-ink", label: "TTS" },
  ].filter((s): s is { key: string; ms: number; cls: string; label: string } => typeof s.ms === "number" && s.ms > 0);
  const total = latency.first_audio ?? segs.reduce((a, s) => a + s.ms, 0);

  return (
    <figure className="mt-2 max-w-[22rem]" aria-label={`İlk sese kadar ${fmtMs(total)}`}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-rule/60">
        {segs.map((s) => (
          <span key={s.key} className={s.cls} style={{ width: `${Math.min(100, (s.ms / SCALE_MS) * 100)}%` }} title={`${s.label}: ${fmtMs(s.ms)}`} />
        ))}
      </div>
      <figcaption className="mt-1 flex flex-wrap gap-x-3 text-[12px] tabular-nums text-graphite">
        <span className="font-medium text-ink">İlk ses {fmtMs(total)}</span>
        {segs.map((s) => (
          <span key={s.key}>
            {s.label} {fmtMs(s.ms)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
