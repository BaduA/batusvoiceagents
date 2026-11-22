"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AgentConfig, ProviderSelection } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { rememberAgent } from "@/lib/client/recent";
import { DefinitionSection, SECTION_TITLES, type Section } from "./DefinitionPanel";
import { VoicePanel, type CallResult } from "./VoicePanel";
import { InspectPanel, type CallView } from "./InspectPanel";
import { AppMark } from "./SiteHeader";
import { IconBolt, IconBook, IconPersona, IconPhone, IconShare, IconSidebarRight, IconSliders, IconTask, IconWave } from "./ui/icons";

type View = "call" | "inspect" | Section;

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
}

const NAV: { id: Section; icon: (p: { size?: number }) => React.ReactNode; tint: string }[] = [
  { id: "task", icon: IconTask, tint: "#5b7cfa" },
  { id: "persona", icon: IconPersona, tint: "#e5609a" },
  { id: "knowledge", icon: IconBook, tint: "#2fa86a" },
  { id: "actions", icon: IconBolt, tint: "#e8a419" },
  { id: "models", icon: IconWave, tint: "#8e6cf0" },
  { id: "advanced", icon: IconSliders, tint: "#8e8e93" },
];

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
      ? [{ id: "call", label: "Görüşme" }, ...NAV.map((n) => ({ id: n.id as View, label: SECTION_TITLES[n.id] })), { id: "inspect", label: "Ölçümler" }]
      : [
          { id: "call", label: "Görüşme" },
          { id: "inspect", label: "Ölçümler" },
        ];

  return (
    <div className="flex h-dvh bg-window lg:p-3">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-surface lg:rounded-[12px] lg:shadow-window">
        {mode === "edit" && (
          <aside className="hidden w-[228px] shrink-0 flex-col border-r border-separator bg-sidebar backdrop-blur-2xl backdrop-saturate-150 md:flex" aria-label="Gezinme">
            <Link href="/" className="flex h-[52px] items-center gap-2 px-4 text-[13px] font-semibold text-secondary hover:text-label">
              <AppMark />
              Voice Agent Playground
            </Link>
            <nav className="flex-1 overflow-y-auto px-2.5 pb-3">
              <SideItem active={view === "call"} onClick={() => setView("call")} icon={<IconPhone size={13} />} tint="#30b158" badge={live ? <span className="size-2 rounded-full bg-end" aria-label="canlı" /> : null}>
                Görüşme
              </SideItem>
              <p className="mb-1 mt-4 px-2.5 text-[11px] font-semibold text-tertiary">Tanım</p>
              {NAV.map((n) => (
                <SideItem
                  key={n.id}
                  active={view === n.id}
                  onClick={() => setView(n.id)}
                  icon={<n.icon size={13} />}
                  tint={n.tint}
                  badge={n.id === "actions" && config.actions.length ? <span className="text-[12px] text-tertiary">{config.actions.length}</span> : null}
                >
                  {SECTION_TITLES[n.id]}
                </SideItem>
              ))}
            </nav>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* unified toolbar */}
          <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-separator bg-surface/80 px-4 backdrop-blur-xl">
            {mode === "shared" && (
              <Link href="/" aria-label="Ana sayfa">
                <AppMark size={24} />
              </Link>
            )}
            {mode === "edit" && (
              <Link href="/" aria-label="Ana sayfa" className="md:hidden">
                <AppMark size={24} />
              </Link>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="truncate text-[15px] font-semibold">{title}</h1>
              <p className={`truncate text-[12px] ${dirty && !isSection ? "text-needle-ink" : "text-secondary"}`}>{sub}</p>
            </div>
            {toolbarExtra}
            {mode === "edit" && agent && <ShareButton agent={agent} />}
            {mode === "edit" && (
              <button className={!dirty && agent ? "btn-text" : "btn-primary"} onClick={() => persist()} disabled={save.status === "saving" || (!dirty && !!agent)}>
                {save.status === "saving" ? "Kontrol ediliyor…" : !agent || dirty ? "Kaydet" : "Kaydedildi"}
              </button>
            )}
            {view === "call" && (
              <button
                className="btn-text hidden px-1.5 xl:inline-flex"
                onClick={() => setInspectorOpen((o) => !o)}
                aria-pressed={inspectorOpen}
                aria-label="Ölçüm panelini aç/kapat"
                title="Ölçüm paneli"
              >
                <IconSidebarRight size={19} />
              </button>
            )}
          </header>

          {/* compact navigation on narrow screens */}
          <nav className={`flex shrink-0 gap-1.5 overflow-x-auto border-b border-separator px-3 py-2 ${mode === "edit" ? "md:hidden" : "xl:hidden"}`} aria-label="Bölüm">
            {pills.map((p) => (
              <button
                key={p.id}
                onClick={() => setView(p.id)}
                aria-pressed={view === p.id}
                className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-medium ${view === p.id ? "bg-label text-surface" : "bg-fill text-label"}`}
              >
                {p.label}
              </button>
            ))}
          </nav>

          {save.status === "error" && (
            <div role="alert" className="flex items-start gap-2 border-b border-separator bg-end-soft px-4 py-2.5 text-[13px] leading-[18px]">
              <span className="font-semibold text-end">Kaydedilmedi.</span>
              <span className="text-label">{save.message}</span>
              <button className="btn-text ml-auto py-0 text-[12px]" onClick={() => setSave({ status: "idle" })}>
                Kapat
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1">
            {/* The call stays mounted while you edit, so a running call isn't dropped. */}
            <main className={`${view === "call" ? "flex" : "hidden"} min-w-0 flex-1 flex-col`}>
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
              <main className="min-w-0 flex-1 overflow-y-auto bg-window">
                <DefinitionSection section={view as Section} config={config} onChange={(c) => {
                  setConfig(c);
                  if (JSON.stringify(c.providers) !== JSON.stringify(config.providers)) setNextCombo(c.providers);
                }} providers={providers} />
              </main>
            )}
            <aside
              className={`${view === "inspect" ? "flex flex-1" : view === "call" && inspectorOpen ? "hidden xl:flex xl:w-[300px] xl:flex-none" : "hidden"} min-h-0 flex-col overflow-y-auto border-l border-separator bg-surface-2`}
              aria-label="Ölçümler"
            >
              <div className={view === "inspect" ? "mx-auto w-full max-w-[520px]" : ""}>
                <InspectPanel call={call} providers={providers} agentName={config.name} nextCombo={nextCombo} onNextCombo={setNextCombo} />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideItem({ active, onClick, icon, tint, badge, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; tint: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-[5px] text-left text-[14px] transition-colors ${active ? "bg-fill-strong font-medium" : "hover:bg-fill"}`}
    >
      <span className="grid size-[22px] place-items-center rounded-[6px] text-white" style={{ background: tint }}>
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {badge}
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
