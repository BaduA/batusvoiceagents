import { ApiError, apiErrorResponse } from "@/lib/agents";
import { listVoices } from "@/lib/voices";

/** GET /api/voices?tts=<catalog id> → the voices that TTS model can speak with. */
export async function GET(req: Request) {
  try {
    const tts = new URL(req.url).searchParams.get("tts");
    if (!tts) throw new ApiError(400, "tts parametresi gerekli.");
    return Response.json(await listVoices(tts));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
