/**
 * The product's mark come alive: a VU meter whose needle follows the agent's voice level.
 * `level` 0..1 drives the needle; `micLevel` 0..1 drives the soft ring at the pivot (your voice).
 */
export function VuDial({
  level = 0,
  micLevel = 0,
  tone = "rest",
  size = 260,
}: {
  level?: number;
  micLevel?: number;
  tone?: "rest" | "speaking" | "listening" | "thinking";
  size?: number;
}) {
  const W = 260;
  const H = 150;
  const cx = W / 2;
  const cy = 132;
  const r = 104;
  const sweep = 50; // degrees each side
  // Perceptual curve so quiet speech still moves the needle.
  const lvl = Math.min(1, Math.pow(Math.max(0, level), 0.55));
  const angle = -sweep + lvl * sweep * 2;
  const color = tone === "speaking" ? "var(--needle)" : tone === "listening" ? "var(--call)" : tone === "thinking" ? "var(--needle)" : "var(--tertiary)";

  const ticks = Array.from({ length: 21 }, (_, i) => {
    const a = (-sweep + (i / 20) * sweep * 2) * (Math.PI / 180);
    const major = i % 5 === 0;
    const r1 = r - (major ? 14 : 8);
    const hot = i >= 16;
    return (
      <line
        key={i}
        x1={cx + r1 * Math.sin(a)}
        y1={cy - r1 * Math.cos(a)}
        x2={cx + r * Math.sin(a)}
        y2={cy - r * Math.cos(a)}
        stroke={hot ? "var(--end)" : "var(--secondary)"}
        strokeOpacity={hot ? 0.75 : major ? 0.75 : 0.4}
        strokeWidth={major ? 2 : 1.2}
        strokeLinecap="round"
      />
    );
  });

  const arc = (from: number, to: number) => {
    const a1 = (from * Math.PI) / 180;
    const a2 = (to * Math.PI) / 180;
    const R = r + 7;
    return `M ${cx + R * Math.sin(a1)} ${cy - R * Math.cos(a1)} A ${R} ${R} 0 0 1 ${cx + R * Math.sin(a2)} ${cy - R * Math.cos(a2)}`;
  };

  return (
    <svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ses seviyesi göstergesi">
      <path d={arc(-sweep, sweep * 0.6)} stroke="var(--fill-strong)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={arc(sweep * 0.6, sweep)} stroke="var(--end)" strokeOpacity={0.55} strokeWidth={3} fill="none" strokeLinecap="round" />
      {ticks}
      {/* your voice: a soft ring around the pivot */}
      <circle cx={cx} cy={cy} r={10 + Math.min(1, micLevel * 2.2) * 16} fill="var(--call)" opacity={0.12 + Math.min(1, micLevel * 2.2) * 0.2} style={{ transition: "r 90ms linear, opacity 90ms linear" }} />
      <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 110ms cubic-bezier(.3,.7,.4,1)" }}>
        <line x1={cx} y1={cy + 8} x2={cx} y2={cy - r + 4} stroke={color} strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={cx} cy={cy} r={7} fill="var(--label)" />
    </svg>
  );
}
