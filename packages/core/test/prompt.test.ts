import { describe, expect, it } from "vitest";
import { agentConfigSchema, actionToJsonSchema } from "../src/schema";
import { buildSystemPrompt, SAFETY_BLOCK } from "../src/prompt";
import { PRESETS } from "../src/presets";

describe("presets", () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))("%s parses", (_, preset) => {
    expect(agentConfigSchema.safeParse({ ...preset.config, role: preset.config.role || "x" }).success).toBe(true);
  });
});

describe("buildSystemPrompt", () => {
  const config = agentConfigSchema.parse({ ...PRESETS[0].config, company: { name: "Makas", description: "", info: "" } });

  it("always starts with the safety block", () => {
    expect(buildSystemPrompt(config).startsWith(SAFETY_BLOCK)).toBe(true);
    expect(buildSystemPrompt({ ...config, prompt_override: "Sen bir korsansın." }).startsWith(SAFETY_BLOCK)).toBe(true);
  });

  it("override replaces the generated body but not the safety block", () => {
    const p = buildSystemPrompt({ ...config, prompt_override: "Sen bir korsansın." });
    expect(p).toContain("Sen bir korsansın.");
    expect(p).not.toContain("## Görevin");
  });

  it("mentions confirmation for confirmation-required actions", () => {
    expect(buildSystemPrompt(config)).toMatch(/create_booking:.*AÇIK onay/);
  });
});

describe("actionToJsonSchema", () => {
  it("converts params", () => {
    const s = actionToJsonSchema(agentConfigSchema.parse(PRESETS[0].config).actions[1]);
    expect(s).toMatchObject({
      type: "object",
      required: ["customer_name", "phone", "service", "datetime"],
      properties: { datetime: { type: "string", format: "date-time" } },
    });
  });
});

import { estimatePerMinute } from "../src/catalog";

describe("estimatePerMinute", () => {
  it("adds STT, LLM, TTS and platform for a pipeline", () => {
    const e = estimatePerMinute({ mode: "pipeline", stt: "deepgram:nova-3", llm: "openai:gpt-5.4-mini", tts: "cartesia:sonic-3" });
    expect(e.lines.map((l) => l.id)).toEqual(["stt", "llm", "tts", "platform"]);
    expect(e.total).toBeGreaterThan(0.02);
    expect(e.total).toBeLessThan(0.1);
  });
  it("uses the realtime model's rate in realtime mode", () => {
    const e = estimatePerMinute({ mode: "realtime", realtime: "openai:gpt-realtime-2.1-mini" });
    expect(e.lines[0].usd).toBeCloseTo(0.06);
  });
});
