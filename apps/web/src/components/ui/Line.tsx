/** Transit-line vocabulary: each pipeline layer is a line with its own colour. */
export const LINES = {
  eou: { color: "var(--eou)", code: "", name: "konuşma sonu" },
  stt: { color: "var(--stt)", code: "S", name: "STT" },
  llm: { color: "var(--llm)", code: "L", name: "LLM" },
  tts: { color: "var(--tts)", code: "T", name: "TTS" },
  rt: { color: "var(--rt)", code: "R", name: "Realtime" },
} as const;
export type LineId = keyof typeof LINES;

/** A metro line badge: rounded square, white code letter on the line colour. */
export function LineBadge({ line, size = 20, label }: { line: LineId | string; size?: number; label?: string }) {
  const l = (LINES as Record<string, { color: string; code: string }>)[line];
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[5px] font-extrabold leading-none text-white"
      style={{ width: size, height: size, background: l?.color ?? line, fontSize: size * 0.55 }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {l?.code ?? ""}
    </span>
  );
}

/** App mark: three stations on one line, in the STT, LLM and TTS colours. */
export function AppMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="var(--board-2)" />
      <path d="M6 18 L12 10 L16 18 L22 10" fill="none" stroke="var(--stt)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10 L16 18" fill="none" stroke="var(--llm)" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 18 L22 10" fill="none" stroke="var(--tts)" strokeWidth="3" strokeLinecap="round" />
      {[
        [6, 18],
        [12, 10],
        [16, 18],
        [22, 10],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#fff" stroke="var(--board-2)" strokeWidth="1" />
      ))}
    </svg>
  );
}
