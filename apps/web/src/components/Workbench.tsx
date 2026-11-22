"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { findLlm, type AgentConfig } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { streamChat, type Turn } from "@/lib/client/chat";
import { rememberAgent } from "@/lib/client/recent";
import { DefinitionPanel } from "./DefinitionPanel";
import { ChatPanel } from "./ChatPanel";
import { InspectPanel } from "./InspectPanel";

type Pane = "define" | "talk" | "inspect";

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  message?: string;
  categories?: string[];
}

export function Workbench({ agent: initialAgent, initialConfig, mode }: { agent: PublicAgent | null; initialConfig: AgentConfig; mode: "edit" | "shared" }) {
  const [agent, setAgent] = useState<PublicAgent | null>(initialAgent);
  const [config, setConfig] = useState<AgentConfig>(initialConfig);
  const [savedJson, setSavedJson] = useState(() => (initialAgent ? JSON.stringify(initialAgent.config) : ""));
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [providers, setProviders] = useState<ProviderAvailability | null>(null);
  const [pane, setPane] = useState<Pane>(mode === "shared" || initialAgent ? "talk" : "define");

  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [sessionLlm, setSessionLlm] = useState<string | undefined>();
  const [llmChoice, setLlmChoice] = useState<string>(initialConfig.providers.llm);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const dirty = mode === "edit" && JSON.stringify(config) !== savedJson;

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => setProviders(null));
  }, []);

  useEffect(() => {
    if (agent) rememberAgent({ id: agent.id, name: agent.name });
  }, [agent]);

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
      setSave({ status: "error", message: issues?.length ? issues.join(" · ") : j.error, categories: j.categories });
      return null;
    }
    const saved = j as PublicAgent;
    setAgent(saved);
    setConfig(saved.config);
    setSavedJson(JSON.stringify(saved.config));
    setSave({ status: "saved" });
    // Update the URL without remounting (router.replace would drop the running conversation).
    if (!agent) window.history.replaceState(null, "", `/agents/${saved.id}`);
    return saved;
  }

  function resetConversation(nextLlm?: string) {
    abortRef.current?.abort();
    setTurns([]);
    setSessionId(undefined);
    setSessionLlm(undefined);
    if (nextLlm) setLlmChoice(nextLlm);
  }

  async function send(text: string) {
    let current = agent;
    if (mode === "edit" && (dirty || !current)) {
      current = await persist();
      if (!current) {
        setPane("define");
        return;
      }
    }
    if (!current) return;
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text };
    const replyId = crypto.randomUUID();
    setTurns((t) => [...t, userTurn, { id: replyId, role: "assistant", text: "", pending: true }]);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const patchReply = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === replyId ? fn(t) : t)));
    try {
      await streamChat(
        { agentId: current.id, sessionId, message: text, llm: sessionId ? undefined : llmChoice },
        (e) => {
          switch (e.type) {
            case "session":
              setSessionId(e.sessionId);
              setSessionLlm(e.llm);
              break;
            case "notice":
              setTurns((ts) => [...ts.slice(0, -1), { id: crypto.randomUUID(), role: "notice", text: e.message }, ts[ts.length - 1]]);
              break;
            case "delta":
              patchReply((t) => ({ ...t, text: t.text + e.text }));
              break;
            case "replace":
              patchReply((t) => ({ ...t, text: e.text }));
              break;
            case "done":
              patchReply((t) => ({ ...t, pending: false, latency: e.latency, costUsd: e.costUsd }));
              break;
            case "error":
              setTurns((ts) => [...ts.filter((t) => !(t.id === replyId && !t.text)), { id: crypto.randomUUID(), role: "error", text: e.message }]);
              break;
          }
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") setTurns((ts) => [...ts, { id: crypto.randomUUID(), role: "error", text: "Bağlantı koptu. Tekrar deneyin." }]);
    } finally {
      patchReply((t) => ({ ...t, pending: false }));
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const replies = turns.filter((t) => t.role === "assistant" && t.latency?.llm_first_token);
    const avgFirst = replies.length ? replies.reduce((a, t) => a + (t.latency!.llm_first_token ?? 0), 0) / replies.length : null;
    const cost = turns.reduce((a, t) => a + (t.costUsd ?? 0), 0);
    return { replies: replies.length, avgFirst, cost };
  }, [turns]);

  const activeLlm = sessionLlm ?? llmChoice;

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
            {p === "define" ? "Tanım" : p === "talk" ? "Görüşme" : "İstekler"}
          </button>
        ))}
      </nav>

      <div className={`grid min-h-0 flex-1 grid-cols-1 gap-3 p-2 sm:p-3 [&>*]:min-w-0 ${mode === "edit" ? "lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)_minmax(300px,360px)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]"}`}>
        {mode === "edit" && (
          <section aria-label="Agent tanımı" className={`${pane === "define" ? "flex" : "hidden"} min-h-0 flex-col rounded-[var(--radius-panel)] bg-sheet lg:flex`}>
            <DefinitionPanel config={config} onChange={setConfig} providers={providers} />
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
                  {save.status === "saving" ? "Kontrol ediliyor…" : agent ? (dirty ? "Değişiklikleri kaydet" : "Kaydedildi") : "Kaydet ve test et"}
                </button>
                {agent && <ShareButton agent={agent} />}
              </div>
            </div>
          </section>
        )}

        <section aria-label="Görüşme" className={`${pane === "talk" ? "flex" : "hidden"} min-h-[70vh] flex-col rounded-[var(--radius-panel)] bg-sheet lg:flex lg:min-h-0`}>
          <ChatPanel
            config={config}
            turns={turns}
            busy={busy}
            onSend={send}
            onReset={() => resetConversation()}
            activeLlm={activeLlm}
            llmLocked={Boolean(sessionId)}
            providers={providers}
            onTryModel={(id) => resetConversation(id)}
            contentWarning={agent?.contentWarning ?? false}
            needsSave={mode === "edit" && (!agent || dirty)}
          />
        </section>

        <section aria-label="İstekler ve metrikler" className={`${pane === "inspect" ? "flex" : "hidden"} min-h-[60vh] flex-col overflow-hidden rounded-[var(--radius-panel)] bg-console lg:flex lg:min-h-0`}>
          <InspectPanel
            stats={stats}
            llmLabel={findLlm(activeLlm)?.label ?? activeLlm}
            turns={turns}
            sessionId={sessionId}
            agentName={config.name}
          />
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
