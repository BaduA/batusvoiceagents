"use client";

import { useState } from "react";

export function ReportButton({ agentId }: { agentId: string }) {
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");
  const [reason, setReason] = useState("");
  if (state === "sent") return <span className="text-[13px] text-graphite">Bildirildi, link incelemeye alındı.</span>;
  if (state === "open")
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          await fetch(`/api/agents/${agentId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
          setState("sent");
        }}
      >
        <label htmlFor="report-reason" className="sr-only">
          Bildirme nedeni
        </label>
        <input id="report-reason" className="field h-9 w-56 py-1 text-[14px]" placeholder="Neden? (isteğe bağlı)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-quiet h-9 py-1 text-[14px]">Bildir</button>
      </form>
    );
  return (
    <button className="text-[14px] text-graphite hover:text-fault" onClick={() => setState("open")}>
      Bildir
    </button>
  );
}
