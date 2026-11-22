import type { NextRequest } from "next/server";
import { apiErrorResponse, reportAgent } from "@/lib/agents";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[id]/report">) {
  try {
    const { id } = await ctx.params;
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
    await reportAgent(id, reason?.trim() || "Neden belirtilmedi");
    return Response.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
