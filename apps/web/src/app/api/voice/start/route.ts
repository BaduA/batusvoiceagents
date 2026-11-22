import { headers } from "next/headers";
import { z } from "zod";
import { pipelineProvidersSchema } from "@vap/core";
import { ApiError, apiErrorResponse, getAgentById } from "@/lib/agents";
import { canEditAgent, clientIpHash, isAdmin } from "@/lib/security";
import { resolveCombo, startVoiceSession, verifyTurnstile } from "@/lib/voice";

const bodySchema = z.object({
  agentId: z.string(),
  consent: z.literal(true, { error: "Sesli görüşme için onay gerekli." }),
  turnstileToken: z.string().optional(),
  providers: pipelineProvidersSchema.partial().optional(),
});

/** Starts a voice call: checks consent, bot protection and limits, then returns a short-lived LiveKit token. */
export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Geçersiz istek.");
    const body = parsed.data;
    const agent = await getAgentById(body.agentId);
    if (!agent) throw new ApiError(404, "Agent bulunamadı.");
    const editor = await canEditAgent(agent);
    if (!editor && !agent.shareEnabled) throw new ApiError(403, "Bu agent paylaşıma kapalı.");
    const admin = await isAdmin();
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    if (!admin && !(await verifyTurnstile(body.turnstileToken, ip))) throw new ApiError(400, "Bot doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.");
    const combo = resolveCombo(agent.config, body.providers);
    const out = await startVoiceSession(agent, combo, await clientIpHash(), admin);
    return Response.json(out);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
