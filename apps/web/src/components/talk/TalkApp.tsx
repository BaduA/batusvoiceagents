"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GearSixIcon } from "@phosphor-icons/react";
import { agentConfigSchema, estimatePerMinute, getPreset, type AgentConfig, type ProviderSelection } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { rememberAgent } from "@/lib/client/recent";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SettingsSheet } from "./SettingsSheet";
import { TalkStage, fmtUsd, type CallResult, type CallSummary } from "./TalkStage";

/**
 * One screen: talk to the agent. Everything else (models, voice, the agent's definition,
 * sharing) lives in a settings sheet that is closed until you open it.
 */
export function TalkApp({
  agent: initialAgent,
  initialConfig,
  mode,
  headerExtra,
}: {
  agent: PublicAgent | null;
  initialConfig: AgentConfig;
  mode: "edit" | "shared";
  headerExtra?: React.ReactNode;
}) {
  const [agent, setAgent] = useState<PublicAgent | null>(initialAgent);
  const [config, setConfig] = useState<AgentConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState(() => (initialAgent ? JSON.stringify(initialAgent.config) : ""));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [combo, setCombo] = useState<ProviderSelection>(initialConfig.providers);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [last, setLast] = useState<CallSummary | null>(null);

  const dirty = mode === "edit" && JSON.stringify(config) !== savedJson;

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((p: ProviderAvailability) => {
        setProviders(p);
        // If a saved model isn't runnable on this server, preselect one that is.
        setCombo((c) => {
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
    setSaving(true);
    setSaveError(null);
    // The model choice made in settings is part of the definition the owner saves.
    const body = { ...config, providers: { ...config.providers, ...combo } };
    const res = await fetch(agent ? `/api/agents/${agent.id}` : "/api/agents", {
      method: agent ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: body }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      const issues = (j.issues as { path: (string | number)[]; message: string }[] | undefined)?.map((i) => `${i.path.join(".")}: ${i.message}`);
      setSaveError(issues?.length ? issues.join("; ") : (j.error ?? "Kaydedilemedi."));
      return null;
    }
    const saved = j as PublicAgent;
    setAgent(saved);
    setConfig(saved.config);
    setSavedJson(JSON.stringify(saved.config));
    if (!agent) window.history.replaceState(null, "", `/agents/${saved.id}`);
    return saved;
  }

  async function ensureSaved(): Promise<string | null> {
    if (mode === "shared") return agent?.id ?? null;
    if (agent && !dirty) return agent.id;
    const saved = await persist();
    if (!saved) setSettingsOpen(true);
    return saved?.id ?? null;
  }

  // In edit mode the model choice is written into the definition, so it counts as a change.
  const onCombo = (c: ProviderSelection) => {
    setCombo(c);
    if (mode === "edit") setConfig((cfg) => ({ ...cfg, providers: c }));
  };

  const onEnded = useCallback((r: CallResult) => {
    setLast({ ...r, costUsd: null });
    // The worker reports usage when it shuts down; fetch the server-side estimate shortly after.
    const load = (attempt: number) =>
      fetch(`/api/sessions/${r.sessionId}`)
        .then((x) => x.json())
        .then((j) => {
          if (j.session?.endedAt) setLast((c) => (c && c.sessionId === r.sessionId ? { ...c, costUsd: Number(j.session.estCostUsd) } : c));
          else if (attempt < 5) setTimeout(() => load(attempt + 1), 1500);
        })
        .catch(() => {});
    setTimeout(() => load(0), 1200);
  }, []);

  const onTemplate = (id: string) => {
    const p = getPreset(id);
    if (!p) return;
    const c = agentConfigSchema.parse({ ...p.config, role: p.config.role || " " });
    if (!p.config.role) c.role = "";
    setConfig(c);
    setCombo((old) => ({ ...c.providers, stt: old.stt, llm: old.llm, tts: old.tts, realtime: old.realtime, mode: old.mode, voice: old.voice, voice_label: old.voice_label }));
  };

  const estimate = useMemo(() => estimatePerMinute(combo), [combo]);
  const override: Partial<ProviderSelection> = JSON.stringify(combo) === JSON.stringify(config.providers) ? {} : combo;

  const saveLabel = !agent
    ? "Henüz kaydedilmedi; ilk görüşmede kaydedilir"
    : dirty
      ? "Kaydedilmemiş değişiklikler"
      : agent.shareEnabled
        ? "Kaydedildi, paylaşıma açık"
        : agent.moderationStatus === "warn"
          ? "Kaydedildi, paylaşım onay bekliyor"
          : "Kaydedildi";

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md font-mono text-[11px] font-bold tracking-wider uppercase" aria-label="Voice Agent Playground, yeni agent">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden />
          <span className="truncate" lang="en">Voice Agent Playground</span>
        </Link>
        <span className="flex-1" />
        {headerExtra}
        <Button
          variant="outline"
          onClick={() => setSettingsOpen(true)}
          className={cn("h-9 gap-2 rounded-full pr-1.5 pl-3", dirty && "border-primary/60")}
          aria-haspopup="dialog"
          aria-label={`Ayarlar, dakikalık maliyet ${fmtUsd(estimate.total)}`}
        >
          <GearSixIcon size={16} weight="bold" />
          <span className="hidden font-mono text-xs font-bold tracking-wider uppercase sm:inline">Ayarlar</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums">{fmtUsd(estimate.total)}/dk</span>
        </Button>
      </header>

      {saveError && (
        <div role="alert" className="mx-auto mb-2 flex w-[calc(100%-2rem)] max-w-md items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm leading-5 text-destructive">
          <span className="min-w-0 flex-1">
            <b>Kaydedilmedi.</b> {saveError}
          </span>
          <button className="text-xs font-semibold underline-offset-2 hover:underline" onClick={() => setSaveError(null)}>
            Kapat
          </button>
        </div>
      )}

      <TalkStage
        config={config}
        ensureSaved={ensureSaved}
        providers={providers}
        providerOverride={override}
        perMinuteUsd={estimate.total}
        contentWarning={agent?.contentWarning ?? false}
        last={last}
        onLiveChange={setLive}
        onEnded={onEnded}
      />

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode={mode}
        live={live}
        config={config}
        onConfig={setConfig}
        combo={combo}
        onCombo={onCombo}
        estimate={estimate}
        providers={providers}
        agent={agent}
        dirty={dirty}
        saveLabel={saveLabel}
        saving={saving}
        onSave={() => void persist()}
        onTemplate={onTemplate}
      />
    </div>
  );
}
