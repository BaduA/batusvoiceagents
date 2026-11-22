"use client";

/** iOS-style switch. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors ${checked ? "bg-call" : "bg-fill-strong"}`}
    >
      <span
        className={`absolute left-0 top-[2px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-transform ${checked ? "translate-x-[20px]" : "translate-x-[2px]"}`}
      />
    </button>
  );
}
