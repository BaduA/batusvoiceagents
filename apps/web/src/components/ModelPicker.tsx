"use client";

import type { ProviderSelection } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";

type Opt = { id: string; label: string; available: boolean };

function Select({ id, label, value, options, onChange, tone }: { id: string; label: string; value: string; options: Opt[]; onChange: (v: string) => void; tone: "light" | "dark" }) {
  return (
    <div>
      <label htmlFor={id} className={`mb-1 block text-[12px] ${tone === "dark" ? "text-console-text/75" : "text-graphite"}`}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-[var(--radius-field)] border px-2 py-1.5 text-[14px] ${tone === "dark" ? "border-console-line bg-[#26343f] text-white" : "border-rule bg-white text-ink"}`}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={!o.available}>
            {o.label}
            {o.available ? "" : " (yapılandırılmamış)"}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Mode + STT/LLM/TTS/voice (pipeline) or realtime model. Disabled options have no key / inference. */
export function ModelPicker({
  value,
  onChange,
  providers,
  tone = "light",
  idPrefix,
}: {
  value: ProviderSelection;
  onChange: (v: ProviderSelection) => void;
  providers: ProviderAvailability;
  tone?: "light" | "dark";
  idPrefix: string;
}) {
  const set = (patch: Partial<ProviderSelection>) => onChange({ ...value, ...patch });
  const tts = providers.tts.find((t) => t.id === value.tts);
  const voices = tts?.voices ?? [];
  const voice = voices.some((v) => v.id === value.voice) ? value.voice : (voices[0]?.id ?? "");
  const base = tone === "dark" ? "text-console-text" : "text-ink";

  return (
    <div className={`space-y-3 ${base}`}>
      <div role="radiogroup" aria-label="Ses modu" className={`grid grid-cols-2 gap-1 rounded-[var(--radius-field)] p-1 ${tone === "dark" ? "bg-[#26343f]" : "bg-desk"}`}>
        {(
          [
            ["pipeline", "STT → LLM → TTS"],
            ["realtime", "Realtime"],
          ] as const
        ).map(([m, l]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.mode === m}
            onClick={() => set({ mode: m })}
            className={`rounded-[5px] px-2 py-1.5 text-[13px] font-medium ${
              value.mode === m ? (tone === "dark" ? "bg-console-text text-console" : "bg-white text-ink shadow-sm") : tone === "dark" ? "text-console-text/80" : "text-graphite"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {value.mode === "pipeline" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Select id={`${idPrefix}-stt`} tone={tone} label="Konuşmayı yazıya çevirme (STT)" value={value.stt} options={providers.stt} onChange={(v) => set({ stt: v })} />
          <Select id={`${idPrefix}-llm`} tone={tone} label="Dil modeli (LLM)" value={value.llm} options={providers.llm} onChange={(v) => set({ llm: v })} />
          <Select id={`${idPrefix}-tts`} tone={tone} label="Seslendirme (TTS)" value={value.tts} options={providers.tts} onChange={(v) => set({ tts: v, voice: "" })} />
          <Select id={`${idPrefix}-voice`} tone={tone} label="Ses" value={voice} options={voices.map((v) => ({ ...v, available: true }))} onChange={(v) => set({ voice: v })} />
        </div>
      ) : (
        <Select id={`${idPrefix}-rt`} tone={tone} label="Realtime model (speech-to-speech)" value={value.realtime} options={providers.realtime} onChange={(v) => set({ realtime: v })} />
      )}
    </div>
  );
}
