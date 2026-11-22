/** Segmented LCD level meter. `level` 0..1; the last segments are the "hot" zone. */
export function LevelMeter({ level = 0, segments = 24, label }: { level?: number; segments?: number; label: string }) {
  const lit = Math.round(Math.min(1, Math.pow(Math.max(0, level), 0.55)) * segments);
  return (
    <div className="flex items-center gap-2" aria-label={label} role="meter" aria-valuemin={0} aria-valuemax={segments} aria-valuenow={lit}>
      <span className="w-10 shrink-0 text-[11px] font-semibold lowercase text-lcd-dim">{label}</span>
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: segments }, (_, i) => {
          const on = i < lit;
          const hot = i >= segments - 4;
          return (
            <span
              key={i}
              className="h-2.5 flex-1 rounded-[1px]"
              style={{ background: on ? (hot ? "var(--signal)" : "var(--lcd-ink)") : "rgb(40 48 31 / 0.12)", transition: "background 60ms linear" }}
            />
          );
        })}
      </div>
    </div>
  );
}
