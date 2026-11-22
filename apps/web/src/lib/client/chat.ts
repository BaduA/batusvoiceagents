"use client";
import type { ChatEvent } from "../runtime";

export type { ChatEvent };

export interface Turn {
  id: string;
  role: "user" | "assistant" | "notice" | "error";
  text: string;
  pending?: boolean;
  latency?: { llm_first_token?: number; stt?: number; tts_first_audio?: number; total?: number };
  costUsd?: number;
}

/** POSTs a chat turn and calls onEvent for each server-sent event. */
export async function streamChat(
  body: { agentId: string; sessionId?: string; message: string; llm?: string },
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    onEvent({ type: "error", message: j.error ?? `İstek başarısız (${res.status}).` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as ChatEvent);
    }
  }
}
