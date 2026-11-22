import type { Turn } from "@/lib/client/chat";

const SCALE_MS = 2500;

function fmt(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}

/**
 * The per-turn latency bar. Segments are drawn to scale (full width = 2.5 s):
 * STT final → LLM first token → TTS first audio. In text mode only the LLM segment exists,
 * followed by the rest of generation in a lighter tone.
 */
export function LatencyStrip({ latency }: { latency: NonNullable<Turn["latency"]> }) {
  const segs: { key: string; ms: number; cls: string; label: string }[] = [];
  if (latency.stt) segs.push({ key: "stt", ms: latency.stt, cls: "bg-graphite", label: "STT" });
  if (latency.llm_first_token) segs.push({ key: "llm", ms: latency.llm_first_token, cls: "bg-needle", label: "LLM ilk token" });
  if (latency.tts_first_audio) segs.push({ key: "tts", ms: latency.tts_first_audio, cls: "bg-ink", label: "TTS ilk ses" });
  const firstResponse = segs.reduce((a, s) => a + s.ms, 0);
  const rest = latency.total && !latency.tts_first_audio ? Math.max(0, latency.total - firstResponse) : 0;

  return (
    <figure className="mt-2 max-w-[22rem]" aria-label={`İlk yanıt ${fmt(firstResponse)}`}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-rule/60">
        {segs.map((s) => (
          <span key={s.key} className={s.cls} style={{ width: `${Math.min(100, (s.ms / SCALE_MS) * 100)}%` }} title={`${s.label}: ${fmt(s.ms)}`} />
        ))}
        {rest > 0 && <span className="bg-needle/30" style={{ width: `${Math.min(100, (rest / SCALE_MS) * 100)}%` }} title={`Üretimin geri kalanı: ${fmt(rest)}`} />}
      </div>
      <figcaption className="mt-1 flex tabular-nums flex-wrap gap-x-3 text-[12px] text-graphite">
        <span className="font-medium text-ink">{fmt(firstResponse)}</span>
        {segs.map((s) => (
          <span key={s.key}>
            {s.label} {fmt(s.ms)}
          </span>
        ))}
        {latency.total ? <span>toplam {fmt(latency.total)}</span> : null}
      </figcaption>
    </figure>
  );
}
