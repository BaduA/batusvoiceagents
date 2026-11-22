import type { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/agents";
import { requireInternal } from "@/lib/internal-auth";
import { voiceBootPayload } from "@/lib/voice";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/internal/voice/[id]">) {
  try {
    requireInternal(req);
    const { id } = await ctx.params;
    return Response.json(await voiceBootPayload(id));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
