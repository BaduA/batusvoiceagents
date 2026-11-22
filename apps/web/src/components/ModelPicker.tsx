"use client";

import type { ProviderSelection } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import { useState } from "react";
import { IconChevron } from "./ui/icons";
import { LINES, type LineId } from "./ui/Line";
import { VoicePickerSheet } from "./VoicePickerSheet";

type Opt = { id: string; label: string; available: boolean };

/** Standard select with the platform's own popup, styled as a field. */
export function Select({ id, value, options, onChange, label }: { id: string; value: string; options: Opt[]; onChange: (v: string) => void; label: string }) {
  return (
    <span className="relative block min-w-0">
      <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="field cursor-pointer appearance-none truncate py-1.5 pr-8">
        {options.map((o) => (
          <option key={o.id} value={o.id} disabled={!o.available}>
            {o.label}
            {o.available ? "" : " (yapılandırılmamış)"}
          </option>
        ))}
      </select>
      <IconChevron size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-ink-3" />
    </span>
  );
}

/** Label-left, control-right row (used in settings lists). */
export function SelectRow({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Opt[]; onChange: (v: string) => void }) {
  return (
    <div className="row">
      <label htmlFor={id} className="label flex-1">
        {label}
      </label>
      <span className="w-[13rem] max-w-[60%]">
        <Select id={id} label={label} value={value} options={options} onChange={onChange} />
      </span>
    </div>
  );
}

/** Standard segmented control. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col rounded-[7px] border border-line bg-surface-2 p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${
            value === v ? "bg-surface text-ink shadow-[0_1px_2px_rgb(20_36_58/0.12)]" : "text-ink-2 hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/**
 * The route: model selection drawn as one line through stations.
 * Pipeline = STT → LLM → TTS (+ voice); Realtime = an express line with one stop.
 */
export function ModelPicker({
  value,
  onChange,
  providers,
  idPrefix,
  compact = false,
  language = "tr",
  sampleText = "Merhaba, size nasıl yardımcı olabilirim?",
}: {
  value: ProviderSelection;
  onChange: (v: ProviderSelection) => void;
  providers: ProviderAvailability;
  idPrefix: string;
  /** Kept for callers; the route reads the same at any width. */
  compact?: boolean;
  language?: string;
  sampleText?: string;
}) {
  void compact;
  const [voiceSheet, setVoiceSheet] = useState(false);
  const set = (patch: Partial<ProviderSelection>) => onChange({ ...value, ...patch });
  const tts = providers.tts.find((t) => t.id === value.tts);
  const voices = tts?.voices ?? [];
  const voice = value.voice || (voices[0]?.id ?? "");
  const voiceLabel = voices.find((v) => v.id === voice)?.label ?? value.voice_label ?? voice;

  const stops: { line: LineId; title: string; hint: string; control: React.ReactNode }[] =
    value.mode === "pipeline"
      ? [
          {
            line: "stt",
            title: "Konuşmayı yazıya çevirir",
            hint: "STT",
            control: <Select id={`${idPrefix}-stt`} label="STT modeli" value={value.stt} options={providers.stt} onChange={(v) => set({ stt: v })} />,
          },
          {
            line: "llm",
            title: "Cevabı yazar",
            hint: "LLM",
            control: <Select id={`${idPrefix}-llm`} label="Dil modeli" value={value.llm} options={providers.llm} onChange={(v) => set({ llm: v })} />,
          },
          {
            line: "tts",
            title: "Cevabı seslendirir",
            hint: "TTS",
            control: (
              <div className="space-y-1.5">
                <Select id={`${idPrefix}-tts`} label="TTS modeli" value={value.tts} options={providers.tts} onChange={(v) => set({ tts: v, voice: "", voice_label: undefined })} />
                <button type="button" onClick={() => setVoiceSheet(true)} aria-haspopup="dialog" className="field flex items-center gap-2 py-1.5 text-left">
                  <span className="text-ink-3">Ses</span>
                  <span className="min-w-0 flex-1 truncate">{voiceLabel}</span>
                  <IconChevron size={14} className="shrink-0 text-ink-3" />
                </button>
              </div>
            ),
          },
        ]
      : [
          {
            line: "rt",
            title: "Dinler ve konuşur, aktarmasız",
            hint: "Realtime",
            control: <Select id={`${idPrefix}-rt`} label="Realtime model" value={value.realtime} options={providers.realtime} onChange={(v) => set({ realtime: v })} />,
          },
        ];

  return (
    <div className="space-y-4">
      <Segmented
        label="Ses modu"
        value={value.mode}
        onChange={(m) => set({ mode: m })}
        options={[
          ["pipeline", "Aktarmalı (3 model)"],
          ["realtime", "Ekspres (realtime)"],
        ]}
      />
      <ol className="relative">
        {stops.map((s, i) => (
          <li key={s.line} className="relative grid grid-cols-[22px_minmax(0,1fr)] gap-x-3 pb-4 last:pb-0">
            {/* line segment to the next station */}
            {i < stops.length - 1 && <span className="absolute left-[9px] top-[18px] bottom-0 w-[4px]" style={{ background: LINES[s.line].color }} aria-hidden />}
            <span className="relative z-10 mt-[3px] block size-[22px] rounded-full bg-surface" style={{ border: `5px solid ${LINES[s.line].color}` }} aria-hidden />
            <div className="min-w-0">
              <p className="mb-1.5 flex items-baseline gap-2 text-[13px] leading-5">
                <span className="font-bold" style={{ color: LINES[s.line].color }}>
                  {s.hint}
                </span>
                <span className="text-ink-2">{s.title}</span>
              </p>
              {s.control}
            </div>
          </li>
        ))}
      </ol>
      {voiceSheet && tts && (
        <VoicePickerSheet
          ttsId={tts.id}
          ttsLabel={tts.label}
          value={voice}
          language={language}
          sampleText={sampleText}
          onClose={() => setVoiceSheet(false)}
          onPick={(id, label) => {
            set({ voice: id, voice_label: label });
            setVoiceSheet(false);
          }}
        />
      )}
    </div>
  );
}
