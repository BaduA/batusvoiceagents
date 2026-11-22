"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentConfig } from "@vap/core";
import type { Turn } from "@/lib/client/chat";
import type { ProviderAvailability } from "@/lib/providers";
import { LatencyStrip } from "./LatencyStrip";

export function ChatPanel(props: {
  config: AgentConfig;
  turns: Turn[];
  busy: boolean;
  onSend: (text: string) => void;
  onReset: () => void;
  activeLlm: string;
  llmLocked: boolean;
  providers: ProviderAvailability | null;
  onTryModel: (id: string) => void;
  contentWarning: boolean;
  needsSave: boolean;
}) {
  const { config, turns, busy, onSend, onReset, activeLlm, providers, onTryModel, contentWarning, needsSave } = props;
  const [text, setText] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    onSend(t);
  };

  const speaker = config.name || "Agent";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule px-4 py-3 sm:px-5">
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <h2 className="truncate text-[17px] font-bold leading-6">{speaker}</h2>
          {config.company.name && <p className="truncate text-[13px] text-graphite">{config.company.name}</p>}
        </div>
        <label className="flex items-center gap-2 text-[13px] text-graphite">
          <span className="sr-only sm:not-sr-only">Model</span>
          <select
            className="rounded-[var(--radius-field)] border border-rule bg-white px-2 py-1 text-[14px] text-ink"
            value={activeLlm}
            onChange={(e) => onTryModel(e.target.value)}
            title="Aynı agent'ı başka bir modelle denemek yeni bir görüşme başlatır"
          >
            {(providers?.llm ?? []).map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.label}
                {m.available ? "" : " (anahtar yok)"}
              </option>
            ))}
            {!providers && <option value={activeLlm}>{activeLlm}</option>}
          </select>
        </label>
        <button className="btn-text text-[14px]" onClick={onReset} disabled={turns.length === 0}>
          Yeni görüşme
        </button>
      </header>

      {contentWarning && (
        <p className="border-b border-rule bg-needle-soft/60 px-5 py-2 text-[13px] text-ink">Bu agent argo veya sert dil içerebilir.</p>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-5" aria-live="polite">
        <ol className="mx-auto max-w-[44rem] space-y-6">
          {config.greeting && <TurnRow speaker={speaker} turn={{ id: "greeting", role: "assistant", text: config.greeting }} />}
          {turns.map((t) => (
            <TurnRow key={t.id} speaker={speaker} turn={t} />
          ))}
        </ol>
        {turns.length === 0 && (
          <p className="mx-auto mt-10 max-w-[44rem] text-[14px] leading-6 text-graphite">
            {needsSave
              ? "İlk mesajı yazdığınızda agent kaydedilir, güvenlik kontrolünden geçer ve görüşme başlar."
              : "Bir mesaj yazarak görüşmeyi başlatın. Her cevabın altında ne kadar sürede geldiği görünür."}
          </p>
        )}
      </div>

      <div className="px-2 pb-2 sm:px-4 sm:pb-4">
        <form
          className="mx-auto flex max-w-[46rem] items-end gap-2 rounded-[var(--radius-panel)] border border-rule bg-white p-2 focus-within:border-ink shadow-[0_6px_24px_-12px_rgb(29_41_53/0.35)]"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label htmlFor="composer" className="sr-only">
            Mesaj
          </label>
          <textarea
            id="composer"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Müşteri gibi yazın…"
            className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 focus-visible:outline-none text-[15px] leading-6 outline-none placeholder:text-graphite/70"
          />
          <button
            type="button"
            disabled
            title="Sesli mod bir sonraki fazda açılacak"
            aria-label="Konuşarak test et (yakında)"
            className="grid size-10 place-items-center rounded-full border border-rule text-graphite disabled:opacity-50"
          >
            <MicIcon />
          </button>
          <button type="submit" className="btn-primary h-10" disabled={busy || !text.trim()}>
            Gönder
          </button>
        </form>
      </div>
    </div>
  );
}

function TurnRow({ turn, speaker }: { turn: Turn; speaker: string }) {
  if (turn.role === "notice") {
    return <li className="text-center text-[13px] text-graphite">{turn.text}</li>;
  }
  if (turn.role === "error") {
    return (
      <li role="alert" className="rounded-[var(--radius-field)] bg-fault-soft px-3 py-2 text-[14px] text-fault">
        {turn.text}
      </li>
    );
  }
  const isAgent = turn.role === "assistant";
  return (
    <li className="grid grid-cols-1 gap-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
      <span className={`pt-0.5 text-[13px] font-medium sm:text-right ${isAgent ? "text-ink" : "text-graphite"}`}>{isAgent ? speaker : "Siz"}</span>
      <div className={isAgent ? "" : "border-l-2 border-rule pl-3"}>
        <p className={`whitespace-pre-wrap text-[16px] leading-7 ${isAgent ? "text-ink" : "text-graphite"}`}>
          {turn.text}
          {turn.pending && <span className="ml-1 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-needle" aria-label="yazıyor" />}
        </p>
        {isAgent && turn.latency && <LatencyStrip latency={turn.latency} />}
      </div>
    </li>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
