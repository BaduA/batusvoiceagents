import type { TurnLatency } from "@/lib/client/types";

const SCALE_MS = 2500;

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}

/**
 * Per-turn latency, drawn to scale (full width = 2.5 s):
 * end of user speech → LLM first token → TTS first audio.
 */
export function LatencyStrip({ latency }: { latency: TurnLatency }) {
  const segs = [
    { key: "eou", ms: latency.eou, color: "var(--tertiary)", label: "Konuşma sonu" },
    { key: "llm", ms: latency.llm_first_token, color: "var(--needle)", label: "LLM" },
    { key: "tts", ms: latency.tts_first_audio, color: "var(--label)", label: "TTS" },
  ].filter((s): s is { key: string; ms: number; color: string; label: string } => typeof s.ms === "number" && s.ms > 0);
  const total = latency.first_audio ?? segs.reduce((a, s) => a + s.ms, 0);

  return (
    <figure className="mt-1.5 w-[13rem] max-w-full pl-1" aria-label={`İlk sese kadar ${fmtMs(total)}`}>
      <div className="flex h-1 w-full gap-px overflow-hidden rounded-full bg-fill">
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${Math.min(100, (s.ms / SCALE_MS) * 100)}%`, background: s.color }} title={`${s.label}: ${fmtMs(s.ms)}`} />
        ))}
      </div>
      <figcaption className="mt-1 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-secondary">
        <span className="font-semibold text-label">{fmtMs(total)}</span>
        {segs.map((s) => (
          <span key={s.key}>
            {s.label} {fmtMs(s.ms)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
