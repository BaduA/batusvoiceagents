import type { TurnLatency } from "@/lib/client/types";

const SCALE_MS = 2500;

export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}

/**
 * Per-turn latency printed on the LCD, drawn to scale (full width = 2.5 s):
 * end of user speech → LLM first token (signal orange) → TTS first audio.
 */
export function LatencyStrip({ latency }: { latency: TurnLatency }) {
  const segs = [
    { key: "eou", ms: latency.eou, color: "var(--lcd-dim)", label: "konuşma sonu" },
    { key: "llm", ms: latency.llm_first_token, color: "var(--signal)", label: "llm" },
    { key: "tts", ms: latency.tts_first_audio, color: "var(--lcd-ink)", label: "tts" },
  ].filter((s): s is { key: string; ms: number; color: string; label: string } => typeof s.ms === "number" && s.ms > 0);
  const total = latency.first_audio ?? segs.reduce((a, s) => a + s.ms, 0);

  return (
    <figure className="mt-1.5 flex max-w-[26rem] items-center gap-2.5" aria-label={`İlk sese kadar ${fmtMs(total)}`}>
      <span className="lcd-num w-[5.2rem] shrink-0 text-[17px] leading-none">{fmtMs(total)}</span>
      <div className="flex h-[7px] flex-1 gap-[2px]" style={{ background: "rgb(40 48 31 / 0.1)" }}>
        {segs.map((s) => (
          <span key={s.key} style={{ width: `${Math.min(100, (s.ms / SCALE_MS) * 100)}%`, background: s.color }} title={`${s.label}: ${fmtMs(s.ms)}`} />
        ))}
      </div>
      <figcaption className="sr-only">{segs.map((s) => `${s.label} ${fmtMs(s.ms)}`).join(", ")}</figcaption>
    </figure>
  );
}
