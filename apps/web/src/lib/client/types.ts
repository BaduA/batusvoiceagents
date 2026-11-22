export interface TurnLatency {
  eou?: number;
  stt?: number;
  llm_first_token?: number;
  tts_first_audio?: number;
  first_audio?: number;
}

export interface TranscriptLine {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
  latency?: TurnLatency;
}

/** Messages the voice worker publishes on the "vap" data topic. */
export type RoomMessage =
  | { type: "turn"; metrics: TurnLatency & { at: number } }
  | { type: "error"; message: string }
  | { type: "time_warning"; secondsLeft: number }
  | { type: "ended"; reason: "time_limit" | "error" };

export interface VoiceStartResponse {
  sessionId: string;
  serverUrl: string;
  token: string;
  maxSeconds: number;
  combo: { mode: "pipeline" | "realtime"; stt: string; llm: string; tts: string; voice: string; voice_label?: string; realtime: string };
}
