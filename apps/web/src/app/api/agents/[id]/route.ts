import type { NextRequest } from "next/server";
import { ApiError, apiErrorResponse, getAgentById, publicAgent, updateAgent } from "@/lib/agents";
import { canEditAgent } from "@/lib/security";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/agents/[id]">) {
  try {
    const { id } = await ctx.params;
    const a = await getAgentById(id);
    if (!a) throw new ApiError(404, "Agent bulunamadı.");
    const editable = await canEditAgent(a);
    if (!editable) throw new ApiError(403, "Bu agent'a erişiminiz yok.");
    return Response.json(publicAgent(a, editable));
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/agents/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(await updateAgent(id, body.config));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
