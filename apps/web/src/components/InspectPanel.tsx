"use client";

import type { Turn } from "@/lib/client/chat";

function fmtMs(ms: number | null) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} sn` : `${Math.round(ms)} ms`;
}

export function InspectPanel({
  stats,
  llmLabel,
  turns,
  sessionId,
  agentName,
}: {
  stats: { replies: number; avgFirst: number | null; cost: number };
  llmLabel: string;
  turns: Turn[];
  sessionId?: string;
  agentName: string;
}) {
  const download = () => {
    const data = {
      agent: agentName,
      sessionId,
      model: llmLabel,
      exportedAt: new Date().toISOString(),
      transcript: turns.filter((t) => t.role === "user" || t.role === "assistant").map((t) => ({ role: t.role, text: t.text, latency: t.latency })),
      requests: [],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionId ?? "gorusme"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col text-console-text">
      <div className="border-b border-console-line px-4 py-3">
        <h2 className="text-[15px] font-bold text-white">Bu görüşme</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          <Metric label="Ort. ilk yanıt" value={fmtMs(stats.avgFirst)} />
          <Metric label="Cevap" value={String(stats.replies)} />
          <Metric label="Tahmini maliyet" value={`$${stats.cost.toFixed(4)}`} />
        </dl>
        <p className="mt-3 text-[13px] text-console-text/80">
          Kanal: yazılı. Model: <span className="text-white">{llmLabel}</span>
        </p>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <h2 className="text-[15px] font-bold text-white">İstek logu</h2>
        <button onClick={download} disabled={turns.length === 0} className="text-[13px] text-console-text/80 underline-offset-2 hover:text-white hover:underline disabled:opacity-40">
          JSON indir
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <p className="rounded-[var(--radius-field)] border border-dashed border-console-line px-3 py-4 text-[13px] leading-5 text-console-text/75">
          Agent bir işlem tetiklediğinde istek burada simüle edilerek listelenir; hiçbir gerçek sisteme gönderilmez.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-console-text/70">{label}</dt>
      <dd className="mt-0.5 font-mono text-[17px] tabular-nums text-white">{value}</dd>
    </div>
  );
}
