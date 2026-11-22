import type { NextRequest } from "next/server";
import { z } from "zod";
import { maskText } from "@vap/core";
import { apiErrorResponse, getAgentById } from "@/lib/agents";
import { getDb, schema } from "@/lib/db";
import { newId } from "@/lib/ids";
import { requireInternal } from "@/lib/internal-auth";
import { logSafetyEvent } from "@/lib/safety";
import { appendTurnMetrics, endVoiceSession } from "@/lib/voice";
import { eq } from "drizzle-orm";

const num = z.number().finite().nonnegative().optional();
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), role: z.enum(["user", "assistant"]), text: z.string().max(8000) }),
  z.object({
    type: z.literal("turn_metrics"),
    metrics: z.object({ at: z.number(), eou: num, stt: num, llm_first_token: num, tts_first_audio: num, first_audio: num }),
  }),
  z.object({ type: z.literal("safety"), decision: z.string(), categories: z.array(z.string()), reason: z.string().max(1000) }),
  z.object({ type: z.literal("end"), durationSec: z.number().nonnegative(), usage: z.record(z.string(), z.number()) }),
]);

/** Worker → web: transcripts (masked before storage), per-turn latency, safety events, session end. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/internal/voice/[id]/events">) {
  try {
    requireInternal(req);
    const { id } = await ctx.params;
    const e = eventSchema.parse(await req.json());
    const db = await getDb();
    switch (e.type) {
      case "message":
        await db.insert(schema.messages).values({ id: newId("msg"), sessionId: id, role: e.role, content: maskText(e.text) });
        break;
      case "turn_metrics":
        await appendTurnMetrics(id, e.metrics);
        break;
      case "safety": {
        const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
        const agent = s ? await getAgentById(s.agentId) : null;
        await logSafetyEvent({ agentId: agent?.id, sessionId: id, ipHash: s?.ipHash ?? "worker", layer: 3, decision: e.decision, categories: e.categories, reason: maskText(e.reason) });
        break;
      }
      case "end":
        await endVoiceSession(id, e.durationSec, e.usage);
        break;
    }
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Geçersiz olay." }, { status: 400 });
    return apiErrorResponse(e);
  }
}
