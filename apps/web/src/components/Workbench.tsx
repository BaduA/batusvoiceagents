"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AgentConfig, ProviderSelection } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { rememberAgent } from "@/lib/client/recent";
import { DefinitionSection, SECTION_TITLES, sample, type Section } from "./DefinitionPanel";
import { VoicePanel, type CallResult } from "./VoicePanel";
import { InspectPanel, type CallView } from "./InspectPanel";
import { AppMark } from "./SiteHeader";
import { IconShare, IconSidebarRight } from "./ui/icons";

type View = "call" | "inspect" | Section;

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

const NAV: { id: Section }[] = [{ id: "task" }, { id: "persona" }, { id: "knowledge" }, { id: "actions" }, { id: "models" }, { id: "advanced" }];

export function Workbench({
  agent: initialAgent,
  initialConfig,
  mode,
  toolbarExtra,
  subtitle,
}: {
  agent: PublicAgent | null;
  initialConfig: AgentConfig;
  mode: "edit" | "shared";
  toolbarExtra?: React.ReactNode;
  subtitle?: string;
}) {
  const [agent, setAgent] = useState<PublicAgent | null>(initialAgent);
  const [config, setConfig] = useState<AgentConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState(() => (initialAgent ? JSON.stringify(initialAgent.config) : ""));
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [view, setView] = useState<View>(mode === "shared" || initialAgent ? "call" : "task");
  const [inspectorOpen, setInspectorOpen] = useState(true);
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
    if (!saved) setView("task");
    return saved?.id ?? null;
  }

  const onLive = useCallback((d: Parameters<React.ComponentProps<typeof VoicePanel>["onLive"]>[0]) => {
    if (!d) return;
    setCall({ sessionId: d.sessionId, lines: d.lines, turns: d.turns, seconds: d.elapsed, combo: d.combo, costUsd: null, live: true });
  }, []);

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
  const isSection = view !== "call" && view !== "inspect";
  const live = call?.live ?? false;

  const title = view === "call" || view === "inspect" || mode === "shared" ? config.name || "Yeni agent" : SECTION_TITLES[view as Section];
  const sub =
    mode === "shared"
      ? config.company.name || "Sesli demo"
      : view === "call" || view === "inspect"
        ? !agent
          ? "Henüz kaydedilmedi"
          : dirty
            ? "Kaydedilmemiş değişiklikler var"
            : agent.shareEnabled
              ? "Paylaşıma açık"
              : agent.moderationStatus === "warn"
                ? "Paylaşım yönetici onayı bekliyor"
                : "Paylaşım kapalı"
        : config.name || "Yeni agent";

  const pills: { id: View; label: string }[] =
    mode === "edit"
      ? [{ id: "call", label: "görüşme" }, ...NAV.map((n) => ({ id: n.id as View, label: SECTION_TITLES[n.id].toLocaleLowerCase("tr") })), { id: "inspect", label: "ölçümler" }]
      : [
          { id: "call", label: "görüşme" },
          { id: "inspect", label: "ölçümler" },
        ];

  return (
    <div className="flex min-h-dvh flex-col bg-body lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 sm:px-5">
        <Link href="/" aria-label="Ana sayfa" className="rounded-[6px]">
          <AppMark size={24} />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="stamp truncate text-[16px]">{title}</h1>
          <p className={`truncate text-[12px] ${dirty && !isSection ? "text-signal-ink" : "text-faint"}`}>{sub}</p>
        </div>
        {toolbarExtra}
        {mode === "edit" && agent && <ShareButton agent={agent} />}
        {mode === "edit" && (
          <button className={!dirty && agent ? "btn-text" : "btn-primary lowercase"} onClick={() => persist()} disabled={save.status === "saving" || (!dirty && !!agent)}>
            {save.status === "saving" ? "kontrol ediliyor…" : !agent || dirty ? "kaydet" : "kaydedildi"}
          </button>
        )}
        {view === "call" && (
          <button
            className="btn-text hidden px-1.5 xl:inline-flex"
            onClick={() => setInspectorOpen((o) => !o)}
            aria-pressed={inspectorOpen}
            aria-label="Model ve ölçüm rafını aç/kapat"
            title="Model ve ölçüm rafı"
          >
            <IconSidebarRight size={19} />
          </button>
        )}
      </header>

      {save.status === "error" && (
        <div role="alert" className="mx-3 mb-2 flex items-start gap-2 rounded-[8px] bg-fault-soft px-4 py-2.5 text-[13px] leading-[18px] sm:mx-5">
          <span className="font-semibold text-fault">Kaydedilmedi.</span>
          <span>{save.message}</span>
          <button className="btn-text ml-auto py-0 text-[12px]" onClick={() => setSave({ status: "idle" })}>
            kapat
          </button>
        </div>
      )}

      {/* key strip on narrow screens */}
      <nav className={`flex shrink-0 gap-2 overflow-x-auto px-3 pb-3 pt-1 sm:px-5 ${mode === "edit" ? "lg:hidden" : "xl:hidden"}`} aria-label="Bölüm">
        {pills.map((p) => (
          <button key={p.id} onClick={() => setView(p.id)} aria-pressed={view === p.id} className="key shrink-0 px-3 py-1.5 text-[13px] lowercase">
            {p.id === "call" && live && <span className="size-2 rounded-full bg-signal" aria-hidden />}
            {p.label}
          </button>
        ))}
      </nav>

      <div
        className={`grid min-h-0 flex-1 grid-cols-1 gap-4 px-3 pb-3 sm:px-5 sm:pb-5 [&>*]:min-w-0 ${
          mode === "edit"
            ? view === "call" && inspectorOpen
              ? "lg:grid-cols-[150px_minmax(0,1fr)] xl:grid-cols-[150px_minmax(0,1fr)_320px]"
              : "lg:grid-cols-[150px_minmax(0,1fr)]"
            : view === "call" && inspectorOpen
              ? "xl:grid-cols-[minmax(0,1fr)_340px]"
              : ""
        }`}
      >
        {mode === "edit" && (
          <nav className="hidden flex-col gap-2 lg:flex" aria-label="Bölümler">
            <KeyButton active={view === "call"} onClick={() => setView("call")} dot={live}>
              görüşme
            </KeyButton>
            <span className="groove my-2 h-[2px]" aria-hidden />
            {NAV.map((n) => (
              <KeyButton key={n.id} active={view === n.id} onClick={() => setView(n.id)} badge={n.id === "actions" && config.actions.length ? String(config.actions.length) : undefined}>
                {SECTION_TITLES[n.id].toLocaleLowerCase("tr")}
              </KeyButton>
            ))}
          </nav>
        )}

        {/* The call stays mounted while you edit, so a running call isn't dropped. */}
        <main className={`${view === "call" ? "flex" : "hidden"} min-h-[32rem] min-w-0 flex-col`}>
          <VoicePanel
            config={config}
            agentId={agent?.id ?? null}
            ensureSaved={ensureSaved}
            providers={providers}
            providerOverride={override}
            contentWarning={agent?.contentWarning ?? false}
            subtitle={subtitle}
            onLive={onLive}
            onEnded={onEnded}
          />
        </main>
        {isSection && (
          <main className="well min-w-0 overflow-y-auto rounded-[12px]">
            <DefinitionSection
              section={view as Section}
              config={config}
              onChange={(c) => {
                setConfig(c);
                if (JSON.stringify(c.providers) !== JSON.stringify(config.providers)) setNextCombo(c.providers);
              }}
              providers={providers}
            />
          </main>
        )}
        <aside
          className={`${view === "inspect" ? "block" : view === "call" && inspectorOpen ? "hidden xl:block" : "hidden"} plate min-h-0 overflow-y-auto`}
          aria-label="Model ve ölçüm rafı"
        >
          <InspectPanel
            call={call}
            providers={providers}
            agentName={config.name}
            nextCombo={nextCombo}
            onNextCombo={setNextCombo}
            language={config.persona.language}
            sampleText={sample(config)}
          />
        </aside>
      </div>
    </div>
  );
}

function KeyButton({ active, onClick, dot, badge, children }: { active: boolean; onClick: () => void; dot?: boolean; badge?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined} className="key w-full justify-start px-3 py-2.5 text-left text-[14px]">
      <span className={`size-2 shrink-0 rounded-full ${dot ? "bg-signal" : active ? "bg-engrave" : "bg-dim/50"}`} style={dot ? { animation: "blink 1.2s steps(1) infinite" } : undefined} aria-hidden />
      <span className="flex-1">{children}</span>
      {badge && <span className="text-[12px] font-medium text-faint">{badge}</span>}
    </button>
  );
}

function ShareButton({ agent }: { agent: PublicAgent }) {
  const [copied, setCopied] = useState(false);
  if (!agent.shareEnabled) return null;
  return (
    <button
      className="btn-quiet"
      title="Paylaşım linkini kopyala"
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
      <IconShare size={15} />
      <span className="hidden sm:inline">{copied ? "Kopyalandı" : "Paylaş"}</span>
    </button>
  );
}
