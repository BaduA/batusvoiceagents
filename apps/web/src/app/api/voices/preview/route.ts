import { z } from "zod";
import { ApiError, apiErrorResponse } from "@/lib/agents";
import { clientIpHash, isAdmin } from "@/lib/security";
import { PreviewUnavailable, synthesizePreview } from "@/lib/voices";

const bodySchema = z.object({
  tts: z.string(),
  voice: z.string().min(1).max(200),
  text: z.string().min(1).max(200),
  language: z.string().max(10).default("tr"),
});

// Previews cost real characters: cache identical samples and cap them per IP.
const audioCache = new Map<string, { body: ArrayBuffer; type: string }>();
const hits = new Map<string, { at: number; n: number }>();
const PER_HOUR = 30;

export async function POST(req: Request) {
  try {
    const b = bodySchema.parse(await req.json());
    const cacheKey = `${b.tts}|${b.voice}|${b.language}|${b.text}`;
    const cached = audioCache.get(cacheKey);
    if (!cached && !(await isAdmin())) {
      const ip = await clientIpHash();
      const h = hits.get(ip);
      const now = Date.now();
      if (!h || now - h.at > 3_600_000) hits.set(ip, { at: now, n: 1 });
      else if (h.n >= PER_HOUR) throw new ApiError(429, "Saatlik ses önizleme sınırına ulaşıldı.");
      else h.n++;
    }
    let audio = cached;
    if (!audio) {
      try {
        audio = await synthesizePreview(b.tts, b.voice, b.text, b.language);
      } catch (e) {
        if (e instanceof PreviewUnavailable) throw e;
        console.error("voice preview failed", e);
        const detail = e instanceof Error && /^(openai|elevenlabs|cartesia) \d+/.test(e.message) ? e.message : "bağlantı kurulamadı";
        return Response.json({ error: `Sağlayıcıdan örnek alınamadı (${detail}). Anahtarı ve ses kimliğini kontrol edin.` }, { status: 502 });
      }
    }
    if (!cached) {
      audioCache.set(cacheKey, audio);
      if (audioCache.size > 80) audioCache.delete(audioCache.keys().next().value!);
    }
    return new Response(audio.body, { headers: { "Content-Type": audio.type, "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    if (e instanceof PreviewUnavailable) return Response.json({ error: e.message }, { status: 503 });
    if (e instanceof z.ZodError) return Response.json({ error: "Geçersiz istek." }, { status: 400 });
    return apiErrorResponse(e);
  }
}
