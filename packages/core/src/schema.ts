import { z } from "zod";

/**
 * Agent config: the single source of truth for an agent.
 * Stored as JSONB in `agents.config`. Text and voice channels both read it.
 */

export const responseModeSchema = z.enum(["simulate", "static", "manual"]);
export type ResponseMode = z.infer<typeof responseModeSchema>;

/** A parameter as the builder form edits it. Converted to JSON Schema for the LLM. */
export const actionParamSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Parametre adı harf/rakam/alt çizgi olmalı"),
  type: z.enum(["string", "number", "integer", "boolean", "date", "datetime", "enum"]),
  description: z.string().max(500).default(""),
  required: z.boolean().default(true),
  enum: z.array(z.string().max(100)).max(50).optional(),
});
export type ActionParam = z.infer<typeof actionParamSchema>;

export const actionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "İşlem adı harf/rakam/alt çizgi olmalı (ör. create_booking)"),
  description: z.string().min(1).max(1000),
  params: z.array(actionParamSchema).max(20).default([]),
  requires_confirmation: z.boolean().default(false),
  response_mode: responseModeSchema.default("simulate"),
  /** Used when response_mode = "static". Any JSON value. */
  static_response: z.unknown().optional(),
  /** Reserved for the future "real webhook" mode. Not called today. */
  webhook_url: z.string().url().optional(),
});
export type AgentAction = z.infer<typeof actionSchema>;

export const pipelineProvidersSchema = z.object({
  mode: z.enum(["pipeline", "realtime"]).default("pipeline"),
  stt: z.string().default("deepgram:nova-3"),
  llm: z.string().default("openai:gpt-5.4-mini"),
  tts: z.string().default("cartesia:sonic-3"),
  voice: z.string().default(""),
  realtime: z.string().default("openai:gpt-realtime-2.1-mini"),
});
export type ProviderSelection = z.infer<typeof pipelineProvidersSchema>;

export const agentConfigSchema = z.object({
  name: z.string().min(1, "Agent'a bir ad verin").max(120),
  company: z
    .object({
      name: z.string().max(200).default(""),
      description: z.string().max(2000).default(""),
      info: z.string().max(5000).default(""),
    })
    .default({ name: "", description: "", info: "" }),
  role: z.string().min(1, "Görev tanımı gerekli").max(5000),
  persona: z
    .object({
      tone: z.string().max(200).default("samimi"),
      language: z.string().max(20).default("tr"),
      style_notes: z.string().max(2000).default(""),
    })
    .default({ tone: "samimi", language: "tr", style_notes: "" }),
  knowledge: z.string().max(30000).default(""),
  greeting: z.string().max(500).default(""),
  actions: z.array(actionSchema).max(15).default([]),
  limits: z
    .object({
      max_reply_sentences: z.number().int().min(1).max(10).default(2),
    })
    .default({ max_reply_sentences: 2 }),
  providers: pipelineProvidersSchema.default(pipelineProvidersSchema.parse({})),
  /** Advanced mode: when set, replaces the generated persona/task prompt (safety block is still prepended). */
  prompt_override: z.string().max(40000).optional(),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentConfigInput = z.input<typeof agentConfigSchema>;

export function parseAgentConfig(input: unknown) {
  return agentConfigSchema.safeParse(input);
}

/** Converts builder params into a JSON Schema object for tool definitions & validation. */
export function actionToJsonSchema(action: AgentAction): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of action.params) {
    let prop: Record<string, unknown>;
    switch (p.type) {
      case "date":
        prop = { type: "string", format: "date" };
        break;
      case "datetime":
        prop = { type: "string", format: "date-time" };
        break;
      case "enum":
        prop = { type: "string", enum: p.enum && p.enum.length ? p.enum : undefined };
        break;
      default:
        prop = { type: p.type };
    }
    if (p.description) prop.description = p.description;
    properties[p.name] = prop;
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, required, additionalProperties: false };
}
