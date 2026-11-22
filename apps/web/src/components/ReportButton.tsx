"use client";

import { useState } from "react";

/** "Bildir": freezes the share link immediately and queues the agent for review. */
export function ReportButton({ agentId }: { agentId: string }) {
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");
  const [reason, setReason] = useState("");
  return (
    <>
      <button className="btn-text text-xs" onClick={() => setState("open")} disabled={state === "sent"}>
        {state === "sent" ? "Bildirildi" : "Bildir"}
      </button>
      {state === "open" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-[2px]" onClick={() => setState("idle")}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[22rem] rounded-[14px] bg-surface p-5 text-center shadow-pop"
            style={{ animation: "rise 180ms ease-out" }}
            onSubmit={async (e) => {
              e.preventDefault();
              await fetch(`/api/agents/${agentId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
              setState("sent");
            }}
          >
            <h2 id="report-title" className="text-[17px] font-semibold">
              Bu agent'ı bildir
            </h2>
            <p className="mt-1 text-[13px] leading-[18px] text-ink-2">Link hemen kapatılır ve incelemeye alınır.</p>
            <label htmlFor="report-reason" className="sr-only">
              Neden
            </label>
            <input id="report-reason" autoFocus className="field mt-4 text-[14px]" placeholder="Neden? (isteğe bağlı)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-quiet py-2" onClick={() => setState("idle")}>
                Vazgeç
              </button>
              <button className="btn bg-danger py-2 text-white">Bildir</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
