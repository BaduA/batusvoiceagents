"use client";

/** Hardware slide switch: a recessed track with a raised knob; orange when on. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="well relative h-[24px] w-[46px] shrink-0 rounded-[6px]"
    >
      <span
        className={`absolute left-0 top-[3px] h-[18px] w-[20px] rounded-[4px] transition-transform ${checked ? "translate-x-[23px] bg-signal" : "translate-x-[3px] bg-plate"}`}
        style={{ boxShadow: "0 0 0 1px var(--groove-dark), inset 0 1px 0 var(--key-hi), 0 1px 0 var(--key-lo)" }}
      />
    </button>
  );
}
