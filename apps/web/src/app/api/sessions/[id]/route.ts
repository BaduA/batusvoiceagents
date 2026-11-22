import type { NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { ApiError, apiErrorResponse, getAgentById } from "@/lib/agents";
import { getDb, schema } from "@/lib/db";
import { canEditAgent, clientIpHash } from "@/lib/security";

/** Transcript + logs + metrics for one session. Visible to the agent's editor or the session's own IP. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id));
    if (!s) throw new ApiError(404, "Görüşme bulunamadı.");
    const agent = await getAgentById(s.agentId);
    if (!agent || (!(await canEditAgent(agent)) && s.ipHash !== (await clientIpHash()))) throw new ApiError(403, "Erişim yok.");
    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.sessionId, id)).orderBy(asc(schema.messages.createdAt));
    const logs = await db.select().from(schema.actionLogs).where(eq(schema.actionLogs.sessionId, id)).orderBy(asc(schema.actionLogs.createdAt));
    const session = { ...s, ipHash: undefined };
    return Response.json({ session, messages: msgs, actionLogs: logs, agent: { id: agent.id, name: agent.name } });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
