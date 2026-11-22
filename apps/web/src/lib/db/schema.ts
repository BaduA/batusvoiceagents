import { boolean, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { AgentConfig, VoiceUsage } from "@vap/core";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull().default("anon"), // "admin" | "anon"
  editTokenHash: text("edit_token_hash").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").$type<AgentConfig>().notNull(),
  shareSlug: text("share_slug").notNull().unique(),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  contentWarning: boolean("content_warning").notNull().default(false),
  moderationStatus: text("moderation_status").notNull().default("pending"), // allow | warn | block | pending
  moderationReason: text("moderation_reason"),
  reportCount: integer("report_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // text | voice | realtime
  providerCombo: jsonb("provider_combo").$type<Record<string, string>>().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  durationSec: integer("duration_sec"),
  estCostUsd: numeric("est_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  ipHash: text("ip_hash").notNull(),
  simState: jsonb("sim_state").$type<Record<string, unknown>>().notNull().default({}),
  turnMetrics: jsonb("turn_metrics").$type<TurnMetrics[]>().notNull().default([]),
  usage: jsonb("usage").$type<VoiceUsage>().notNull().default({}),
});

/** One agent turn, measured by the voice worker. All values in ms. */
export type TurnMetrics = {
  at: number;
  /** user stopped speaking → turn committed (includes STT finalisation) */
  eou?: number;
  stt?: number;
  llm_first_token?: number;
  tts_first_audio?: number;
  /** end of user speech → first agent audio */
  first_audio?: number;
};

export type LatencyMs = { stt?: number; llm_first_token?: number; tts_first_audio?: number; total?: number };

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant | system
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  latencyMs: jsonb("latency_ms").$type<LatencyMs>(),
  usage: jsonb("usage").$type<{ input?: number; output?: number }>(),
});

export const actionLogs = pgTable("action_logs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  actionName: text("action_name").notNull(),
  params: jsonb("params"),
  validationErrors: jsonb("validation_errors"),
  response: jsonb("response"),
  responseMode: text("response_mode").notNull(),
  status: text("status").notNull(), // pending | success | error
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usageLimits = pgTable(
  "usage_limits",
  {
    ipHash: text("ip_hash").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    sessionCount: integer("session_count").notNull().default(0),
    premiumSessionCount: integer("premium_session_count").notNull().default(0),
    totalSeconds: integer("total_seconds").notNull().default(0),
    blockedAttempts: integer("blocked_attempts").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ipHash, t.date] })],
);

export const safetyEvents = pgTable("safety_events", {
  id: text("id").primaryKey(),
  agentId: text("agent_id"),
  sessionId: text("session_id"),
  ipHash: text("ip_hash").notNull(),
  layer: integer("layer").notNull(),
  decision: text("decision").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
