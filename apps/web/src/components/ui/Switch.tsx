"use client";

/** Standard toggle switch. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-150 ${checked ? "bg-stt" : "bg-line-strong"}`}
    >
      <span className={`absolute left-0 top-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.3)] transition-transform duration-150 ${checked ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
    </button>
  );
}
