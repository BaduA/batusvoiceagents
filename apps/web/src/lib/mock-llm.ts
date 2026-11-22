import "server-only";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * DEV ONLY. With DEV_MOCK_LLM=1 (and NODE_ENV !== "production") every LLM call is answered by this mock,
 * so the UI can be exercised without API keys. It never runs in production builds.
 */
export const mockEnabled = () => process.env.NODE_ENV !== "production" && process.env.DEV_MOCK_LLM === "1";

const usage = (i: number, o: number) => ({
  inputTokens: { total: i, noCache: i, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: o, text: o, reasoning: undefined },
});

function lastUserText(prompt: unknown): string {
  const msgs = (prompt as { role: string; content: unknown }[]) ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role !== "user") continue;
    const c = msgs[i].content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((p: { text?: string }) => p.text ?? "").join(" ");
  }
  return "";
}

export function mockModel() {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: "mock",
    doGenerate: async ({ prompt }) => {
      const text = lastUserText(prompt);
      const profane = /küfür|argo|sert|kaba|ağzı bozuk/i.test(text);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              decision: "allow",
              categories: profane ? ["ok_profanity_persona"] : [],
              reason: "Mock sınıflandırıcı: geliştirme modu.",
            }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: usage(300, 30),
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      const user = lastUserText(prompt).slice(0, 80);
      const reply = `(Mock model) "${user}" mesajınızı aldım. Gerçek yanıtlar için sunucuya bir LLM anahtarı ekleyin.`;
      const words = reply.split(/(?<= )/);
      return {
        stream: simulateReadableStream({
          initialDelayInMs: 350,
          chunkDelayInMs: 25,
          chunks: [
            { type: "text-start", id: "t" },
            ...words.map((w) => ({ type: "text-delta" as const, id: "t", delta: w })),
            { type: "text-end", id: "t" },
            { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: usage(420, words.length * 2) },
          ],
        }),
      };
    },
  });
}
