import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, apiErrorResponse, getAgentById } from "@/lib/agents";
import { getDb, schema } from "@/lib/db";
import { resolveLlm, runTextTurn, startSession, type ChatEvent } from "@/lib/runtime";
import { canEditAgent, clientIpHash, isAdmin } from "@/lib/security";

const bodySchema = z.object({
  agentId: z.string(),
  sessionId: z.string().optional(),
  message: z.string().min(1).max(4000),
  llm: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const agent = await getAgentById(body.agentId);
    if (!agent) throw new ApiError(404, "Agent bulunamadı.");
    const editor = await canEditAgent(agent);
    if (!editor && !agent.shareEnabled) throw new ApiError(403, "Bu agent paylaşıma kapalı.");

    const admin = await isAdmin();
    const ipHash = await clientIpHash();
    const db = await getDb();

    let sessionId = body.sessionId;
    let llmId: string;
    let notice: string | undefined;
    let isNew = false;
    if (sessionId) {
      const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sessionId));
      if (!s || s.agentId !== agent.id) throw new ApiError(404, "Görüşme bulunamadı.");
      llmId = s.providerCombo.llm;
    } else {
      const r = resolveLlm(agent.config, body.llm);
      llmId = r.id;
      if (r.fallback) notice = `Seçili modelin anahtarı yok, ${llmId} ile devam ediliyor.`;
      sessionId = await startSession(agent, ipHash, admin, llmId);
      isNew = true;
    }

    const encoder = new TextEncoder();
    const sid = sessionId;
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: ChatEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        if (isNew) send({ type: "session", sessionId: sid, llm: llmId });
        if (notice) send({ type: "notice", message: notice });
        try {
          for await (const e of runTextTurn({ agent, sessionId: sid, llmId, userText: body.message, ipHash })) send(e);
        } catch (e) {
          console.error(e);
          send({ type: "error", message: "Beklenmeyen bir hata oluştu." });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json({ error: "Geçersiz istek." }, { status: 400 });
    return apiErrorResponse(e);
  }
}
