/** Worker → web app calls. The web app owns agent configs, sessions and the database. */

export interface ResolvedModel {
  id: string;
  provider: string;
  model: string;
  inference: string | null;
  envKey: string;
}

export interface VoiceBoot {
  sessionId: string;
  agentId: string;
  instructions: string;
  greeting: string;
  language: string;
  maxSeconds: number;
  mode: "pipeline" | "realtime";
  stt?: ResolvedModel;
  llm?: ResolvedModel;
  tts?: ResolvedModel;
  voice: string;
  realtime?: ResolvedModel;
  fillerPhrase: string;
}

export type WorkerEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "turn_metrics"; metrics: TurnMetrics }
  | { type: "safety"; decision: string; categories: string[]; reason: string }
  | { type: "end"; durationSec: number; usage: Record<string, number> };

export interface TurnMetrics {
  at: number;
  eou?: number;
  stt?: number;
  llm_first_token?: number;
  tts_first_audio?: number;
  first_audio?: number;
}

const base = () => process.env.WEB_BASE_URL ?? "http://localhost:3000";
const auth = () => ({ Authorization: `Bearer ${process.env.INTERNAL_API_SECRET ?? ""}` });

export async function fetchBoot(sessionId: string): Promise<VoiceBoot> {
  const r = await fetch(`${base()}/api/internal/voice/${encodeURIComponent(sessionId)}`, { headers: auth() });
  if (!r.ok) throw new Error(`boot failed: ${r.status} ${await r.text()}`);
  return (await r.json()) as VoiceBoot;
}

/** Fire-and-forget; a lost transcript line must never break the call. */
export function postEvent(sessionId: string, e: WorkerEvent) {
  return fetch(`${base()}/api/internal/voice/${encodeURIComponent(sessionId)}/events`, {
    method: "POST",
    headers: { ...auth(), "Content-Type": "application/json" },
    body: JSON.stringify(e),
  }).catch((err) => console.error("postEvent failed", e.type, err));
}
