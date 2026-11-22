"use client";

import type { ProviderSelection } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import { IconChevron } from "./ui/icons";

type Opt = { id: string; label: string; available: boolean };

/** Native popup-button style select inside a grouped row: label left, value right. */
export function SelectRow({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Opt[]; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="row cursor-pointer">
      <span className="label shrink-0 whitespace-nowrap">{label}</span>
      <span className="relative ml-auto flex min-w-0 items-center gap-1 text-[15px] text-secondary">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 max-w-[13rem] cursor-pointer appearance-none truncate bg-transparent pr-4 text-right text-secondary outline-none"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id} disabled={!o.available}>
              {o.label}
              {o.available ? "" : " (yapılandırılmamış)"}
            </option>
          ))}
        </select>
        <IconChevron size={13} className="pointer-events-none absolute right-0 rotate-90 text-tertiary" />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[9px] bg-fill p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[7px] px-3 py-1 text-[13px] font-medium transition-colors ${
            value === v ? "bg-surface text-label shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)]" : "text-secondary hover:text-label"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Mode + STT/LLM/TTS/voice (pipeline) or realtime model, as an inset grouped list. */
export function ModelPicker({
  value,
  onChange,
  providers,
  idPrefix,
  compact = false,
}: {
  value: ProviderSelection;
  onChange: (v: ProviderSelection) => void;
  providers: ProviderAvailability;
  idPrefix: string;
  /** Short labels for narrow places like the inspector. */
  compact?: boolean;
}) {
  const L = compact
    ? { pipeline: "Pipeline", stt: "STT", llm: "LLM", tts: "TTS", voice: "Ses", rt: "Model" }
    : { pipeline: "STT → LLM → TTS", stt: "Yazıya çevirme", llm: "Dil modeli", tts: "Seslendirme", voice: "Ses", rt: "Realtime model" };
  const set = (patch: Partial<ProviderSelection>) => onChange({ ...value, ...patch });
  const tts = providers.tts.find((t) => t.id === value.tts);
  const voices = tts?.voices ?? [];
  const voice = voices.some((v) => v.id === value.voice) ? value.voice : (voices[0]?.id ?? "");

  return (
    <div className="space-y-3">
      <Segmented
        label="Ses modu"
        value={value.mode}
        onChange={(m) => set({ mode: m })}
        options={[
          ["pipeline", L.pipeline],
          ["realtime", "Realtime"],
        ]}
      />
      <div className="group-list">
        {value.mode === "pipeline" ? (
          <>
            <SelectRow id={`${idPrefix}-stt`} label={L.stt} value={value.stt} options={providers.stt} onChange={(v) => set({ stt: v })} />
            <SelectRow id={`${idPrefix}-llm`} label={L.llm} value={value.llm} options={providers.llm} onChange={(v) => set({ llm: v })} />
            <SelectRow id={`${idPrefix}-tts`} label={L.tts} value={value.tts} options={providers.tts} onChange={(v) => set({ tts: v, voice: "" })} />
            <SelectRow id={`${idPrefix}-voice`} label={L.voice} value={voice} options={voices.map((v) => ({ ...v, available: true }))} onChange={(v) => set({ voice: v })} />
          </>
        ) : (
          <SelectRow id={`${idPrefix}-rt`} label={L.rt} value={value.realtime} options={providers.realtime} onChange={(v) => set({ realtime: v })} />
        )}
      </div>
    </div>
  );
}
