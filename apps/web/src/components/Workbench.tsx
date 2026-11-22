"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentConfig, ProviderSelection } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { rememberAgent } from "@/lib/client/recent";
import { DefinitionPanel } from "./DefinitionPanel";
import { VoicePanel, type CallResult } from "./VoicePanel";
import { InspectPanel, type CallView } from "./InspectPanel";

type Pane = "define" | "talk" | "inspect";

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

export function Workbench({ agent: initialAgent, initialConfig, mode }: { agent: PublicAgent | null; initialConfig: AgentConfig; mode: "edit" | "shared" }) {
  const [agent, setAgent] = useState<PublicAgent | null>(initialAgent);
  const [config, setConfig] = useState<AgentConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState(() => (initialAgent ? JSON.stringify(initialAgent.config) : ""));
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [pane, setPane] = useState<Pane>(mode === "shared" || initialAgent ? "talk" : "define");
  const [call, setCall] = useState<CallView | null>(null);
  const [nextCombo, setNextCombo] = useState<ProviderSelection>(initialConfig.providers);

  const dirty = mode === "edit" && JSON.stringify(config) !== savedJson;

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((p: ProviderAvailability) => {
        setProviders(p);
        // Preselect runnable models for "try other models" when the saved ones aren't configured here.
        setNextCombo((c) => {
          const pick = (list: { id: string; available: boolean }[], id: string) =>
            list.some((m) => m.id === id && m.available) ? id : (list.find((m) => m.available)?.id ?? id);
          return { ...c, stt: pick(p.stt, c.stt), llm: pick(p.llm, c.llm), tts: pick(p.tts, c.tts), realtime: pick(p.realtime, c.realtime) };
        });
      })
      .catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    if (agent && mode === "edit") rememberAgent({ id: agent.id, name: agent.name });
  }, [agent, mode]);

  async function persist(): Promise<PublicAgent | null> {
    setSave({ status: "saving" });
    const res = await fetch(agent ? `/api/agents/${agent.id}` : "/api/agents", {
      method: agent ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      const issues = (j.issues as { path: (string | number)[]; message: string }[] | undefined)?.map((i) => `${i.path.join(".")}: ${i.message}`);
      setSave({ status: "error", message: issues?.length ? issues.join("; ") : j.error });
      return null;
    }
    const saved = j as PublicAgent;
    setAgent(saved);
    setConfig(saved.config);
    setSavedJson(JSON.stringify(saved.config));
    setNextCombo(saved.config.providers);
    setSave({ status: "saved" });
    // Update the URL without remounting the workbench.
    if (!agent) window.history.replaceState(null, "", `/agents/${saved.id}`);
    return saved;
  }

  async function ensureSaved(): Promise<string | null> {
    if (mode === "shared") return agent?.id ?? null;
    if (agent && !dirty) return agent.id;
    const saved = await persist();
    if (!saved) setPane("define");
    return saved?.id ?? null;
  }

  const onLive = useCallback(
    (d: Parameters<React.ComponentProps<typeof VoicePanel>["onLive"]>[0]) => {
      if (!d) return;
      setCall({ sessionId: d.sessionId, lines: d.lines, turns: d.turns, seconds: d.elapsed, combo: d.combo, costUsd: null, live: true });
    },
    [],
  );

  const onEnded = useCallback((r: CallResult) => {
    setCall({ sessionId: r.sessionId, lines: r.lines, turns: r.turns, seconds: r.durationSec, combo: r.combo, costUsd: null, live: false });
    // The worker reports usage when it shuts down; fetch the server-side estimate shortly after.
    const load = (attempt: number) =>
      fetch(`/api/sessions/${r.sessionId}`)
        .then((x) => x.json())
        .then((j) => {
          if (j.session?.endedAt) setCall((c) => (c && c.sessionId === r.sessionId ? { ...c, costUsd: Number(j.session.estCostUsd) } : c));
          else if (attempt < 5) setTimeout(() => load(attempt + 1), 1500);
        })
        .catch(() => {});
    setTimeout(() => load(0), 1200);
  }, []);

  const override: Partial<ProviderSelection> = JSON.stringify(nextCombo) === JSON.stringify(config.providers) ? {} : nextCombo;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav className="flex gap-1 border-b border-rule bg-sheet px-3 py-2 lg:hidden" aria-label="Bölüm">
        {(mode === "edit" ? (["define", "talk", "inspect"] as Pane[]) : (["talk", "inspect"] as Pane[])).map((p) => (
          <button
            key={p}
            onClick={() => setPane(p)}
            aria-pressed={pane === p}
            className={`flex-1 rounded-[var(--radius-field)] px-3 py-1.5 text-[14px] font-medium ${pane === p ? "bg-ink text-sheet" : "text-graphite"}`}
          >
            {p === "define" ? "Tanım" : p === "talk" ? "Görüşme" : "Ölçümler"}
          </button>
        ))}
      </nav>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-3 p-2 sm:p-3 [&>*]:min-w-0 ${
          mode === "edit" ? "lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(300px,360px)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"
        }`}
      >
        {mode === "edit" && (
          <section aria-label="Agent tanımı" className={`${pane === "define" ? "flex" : "hidden"} min-h-0 flex-col rounded-[var(--radius-panel)] bg-sheet lg:flex`}>
            <DefinitionPanel
              config={config}
              onChange={(c) => {
                setConfig(c);
                if (JSON.stringify(c.providers) !== JSON.stringify(config.providers)) setNextCombo(c.providers);
              }}
              providers={providers}
            />
            <div className="border-t border-rule px-4 py-3">
              {save.status === "error" && (
                <div role="alert" className="mb-3 rounded-[var(--radius-field)] bg-fault-soft px-3 py-2 text-[14px] leading-5 text-fault">
                  <p className="font-medium">Kaydedilmedi</p>
                  <p className="mt-0.5 text-ink">{save.message}</p>
                </div>
              )}
              {agent?.moderationStatus === "warn" && !dirty && (
                <p className="mb-3 text-[13px] leading-5 text-graphite">Kaydedildi, paylaşım linki yönetici onayı bekliyor. {agent.moderationReason}</p>
              )}
              <div className="flex items-center gap-3">
                <button className="btn-primary flex-1" onClick={() => persist()} disabled={save.status === "saving" || (!dirty && !!agent)}>
                  {save.status === "saving" ? "Kontrol ediliyor…" : agent ? (dirty ? "Değişiklikleri kaydet" : "Kaydedildi") : "Kaydet"}
                </button>
                {agent && <ShareButton agent={agent} />}
              </div>
            </div>
          </section>
        )}

        <section aria-label="Görüşme" className={`${pane === "talk" ? "flex" : "hidden"} min-h-[70vh] flex-col rounded-[var(--radius-panel)] bg-sheet lg:flex lg:min-h-0`}>
          <VoicePanel
            config={config}
            agentId={agent?.id ?? null}
            ensureSaved={ensureSaved}
            providers={providers}
            providerOverride={override}
            contentWarning={agent?.contentWarning ?? false}
            onLive={onLive}
            onEnded={onEnded}
          />
        </section>

        <section aria-label="Ölçümler" className={`${pane === "inspect" ? "flex" : "hidden"} min-h-[60vh] flex-col overflow-hidden rounded-[var(--radius-panel)] bg-console lg:flex lg:min-h-0`}>
          <InspectPanel call={call} providers={providers} agentName={config.name} nextCombo={nextCombo} onNextCombo={setNextCombo} />
        </section>
      </div>
    </div>
  );
}

function ShareButton({ agent }: { agent: PublicAgent }) {
  const [copied, setCopied] = useState(false);
  if (!agent.shareEnabled) {
    return (
      <span className="text-[13px] text-graphite" title={agent.moderationReason ?? ""}>
        Paylaşım kapalı
      </span>
    );
  }
  return (
    <button
      className="btn-quiet"
      onClick={async () => {
        const url = `${location.origin}/a/${agent.shareSlug}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Paylaşım linki", url);
        }
      }}
    >
      {copied ? "Link kopyalandı" : "Linki kopyala"}
    </button>
  );
}
