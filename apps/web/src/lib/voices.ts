import "server-only";
import { findTts } from "@vap/core";

/**
 * Voice catalogue per TTS model. With the provider's own key we list its whole library live
 * (ElevenLabs: your voices incl. premade ones; Cartesia: public + your voices). Without a key we
 * fall back to the small static list in the catalog. Any voice ID can also be pasted in the UI.
 */

export interface VoiceInfo {
  id: string;
  label: string;
  description?: string;
  /** ISO-ish language codes the voice is made for, lower-case ("tr", "en"). Empty = unknown / multilingual. */
  languages: string[];
  gender?: string;
  /** Free sample hosted by the provider; played directly in the browser. */
  previewUrl?: string;
}

export interface VoiceList {
  voices: VoiceInfo[];
  source: "api" | "static";
  note?: string;
}

const CARTESIA_VERSION = "2025-04-16"; // same version the LiveKit Cartesia plugin speaks
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: VoiceList }>();

const key = (name: string) => process.env[name]?.trim() || "";
const norm = (l?: string | null) => (l ? l.toLowerCase().split(/[-_]/)[0] : "");

export async function listVoices(ttsId: string): Promise<VoiceList> {
  const model = findTts(ttsId);
  if (!model) throw new Error("Bilinmeyen TTS modeli.");
  const hit = cache.get(ttsId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const staticList: VoiceList = {
    voices: model.voices.map((v) => ({ id: v.id, label: v.label, languages: [] })),
    source: "static",
  };

  let value: VoiceList = staticList;
  try {
    if (model.provider === "elevenlabs" && key("ELEVENLABS_API_KEY")) value = await elevenLabsVoices();
    else if (model.provider === "cartesia" && key("CARTESIA_API_KEY")) value = await cartesiaVoices();
    else if (model.provider === "openai") value = { ...staticList, note: "OpenAI'nin 13 hazır sesi. İngilizce için optimize edilmiştir; Türkçe konuşabilir ama aksanlı olabilir." };
    else if (model.provider === "cartesia")
      value = { ...staticList, note: "Cartesia kütüphanesinin tamamı için sunucuya CARTESIA_API_KEY ekleyin. Kütüphaneden bir ses kimliğini aşağıya yapıştırarak da kullanabilirsiniz." };
    else if (model.provider === "elevenlabs") value = { ...staticList, note: "Ses listesi için sunucuya ELEVENLABS_API_KEY ekleyin." };
  } catch (e) {
    console.error("voice list failed", ttsId, e);
    value = { ...staticList, note: "Sağlayıcının ses listesi şu an alınamadı; temel sesler gösteriliyor." };
  }
  cache.set(ttsId, { at: Date.now(), value });
  return value;
}

async function elevenLabsVoices(): Promise<VoiceList> {
  const out: VoiceInfo[] = [];
  let token: string | null = null;
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://api.elevenlabs.io/v2/voices");
    url.searchParams.set("page_size", "100");
    if (token) url.searchParams.set("next_page_token", token);
    const r = await fetch(url, { headers: { "xi-api-key": key("ELEVENLABS_API_KEY") } });
    if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
    const j = (await r.json()) as {
      voices: {
        voice_id: string;
        name: string;
        description?: string | null;
        preview_url?: string | null;
        labels?: Record<string, string>;
        verified_languages?: { language?: string; preview_url?: string | null }[] | null;
      }[];
      has_more?: boolean;
      next_page_token?: string | null;
    };
    for (const v of j.voices ?? []) {
      const langs = new Set<string>();
      if (v.labels?.language) langs.add(norm(v.labels.language));
      for (const vl of v.verified_languages ?? []) if (vl.language) langs.add(norm(vl.language));
      out.push({
        id: v.voice_id,
        label: v.name,
        description: [v.labels?.accent, v.labels?.age, v.labels?.description ?? v.labels?.descriptive].filter(Boolean).join(", ") || v.description || undefined,
        gender: v.labels?.gender,
        languages: [...langs].filter(Boolean),
        previewUrl: v.preview_url ?? undefined,
      });
    }
    if (!j.has_more || !j.next_page_token) break;
    token = j.next_page_token;
  }
  return {
    voices: out,
    source: "api",
    note: "ElevenLabs hesabınızdaki sesler. Türkçe sesleri ElevenLabs sitesindeki Voice Library'den “My Voices”a eklediğinizde burada görünür. Çok dilli modeller hazır seslerle de Türkçe konuşur.",
  };
}

async function cartesiaVoices(): Promise<VoiceList> {
  const out: VoiceInfo[] = [];
  let after: string | null = null;
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://api.cartesia.ai/voices");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("starting_after", after);
    const r = await fetch(url, { headers: { "X-API-Key": key("CARTESIA_API_KEY"), "Cartesia-Version": CARTESIA_VERSION } });
    if (!r.ok) throw new Error(`cartesia ${r.status}`);
    const j = (await r.json()) as unknown;
    // Newer API versions page as { data, has_more }; older ones return a bare array.
    const items = (Array.isArray(j) ? j : ((j as { data?: unknown[] }).data ?? [])) as {
      id: string;
      name: string;
      description?: string;
      language?: string;
      gender?: string;
    }[];
    for (const v of items) {
      out.push({ id: v.id, label: v.name, description: v.description || undefined, gender: v.gender || undefined, languages: v.language ? [norm(v.language)] : [] });
    }
    const hasMore = !Array.isArray(j) && Boolean((j as { has_more?: boolean }).has_more);
    if (!hasMore || items.length === 0) break;
    after = items[items.length - 1].id;
  }
  return { voices: out, source: "api", note: "Cartesia kütüphanesindeki herkese açık sesler ve sizin sesleriniz." };
}

/** Synthesizes a short sample with the provider's own key. Returns audio bytes + content type. */
export async function synthesizePreview(ttsId: string, voice: string, text: string, language: string): Promise<{ body: ArrayBuffer; type: string }> {
  const model = findTts(ttsId);
  if (!model) throw new Error("Bilinmeyen TTS modeli.");
  switch (model.provider) {
    case "openai": {
      if (!key("OPENAI_API_KEY")) throw new PreviewUnavailable("OpenAI");
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: model.model, voice, input: text, response_format: "mp3" }),
      });
      if (!r.ok) throw new Error(`openai ${r.status}`);
      return { body: await r.arrayBuffer(), type: "audio/mpeg" };
    }
    case "elevenlabs": {
      if (!key("ELEVENLABS_API_KEY")) throw new PreviewUnavailable("ElevenLabs");
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model.model, language_code: language }),
      });
      if (!r.ok) throw new Error(`elevenlabs ${r.status}`);
      return { body: await r.arrayBuffer(), type: "audio/mpeg" };
    }
    case "cartesia": {
      if (!key("CARTESIA_API_KEY")) throw new PreviewUnavailable("Cartesia");
      const r = await fetch("https://api.cartesia.ai/tts/bytes", {
        method: "POST",
        headers: { "X-API-Key": key("CARTESIA_API_KEY"), "Cartesia-Version": CARTESIA_VERSION, "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: model.model,
          transcript: text,
          voice: { mode: "id", id: voice },
          output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 24000 },
          language,
        }),
      });
      if (!r.ok) throw new Error(`cartesia ${r.status}`);
      return { body: await r.arrayBuffer(), type: "audio/wav" };
    }
  }
}

export class PreviewUnavailable extends Error {
  constructor(provider: string) {
    super(`Önizleme için sunucuda ${provider} anahtarı gerekli.`);
  }
}
