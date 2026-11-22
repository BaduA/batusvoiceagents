# Voice Agent Playground

Herhangi bir şirket ve görev için yazılı/sesli bir AI agent'ı birkaç dakikada tanımla, modelleri seç, test et ve linkini gönder.

**Problem:** Freelance AI-agent tekliflerinde "yapabilirim" demek yetmiyor. **Çözüm:** İşverenin görevini bu playground'a tanımla, çalışan bir demo linki gönder. Her cevabın gecikmesi, maliyeti ve agent'ın tetiklediği (simüle) işlemler görünür.

> Durum: **Faz 1 (builder + yazılı chat) ve Faz 2 (güvenlik, limitler, admin) tamam.** Sesli mod (Faz 3–4) ve işlem simülatörü (Faz 5) sırada. Ayrıntı: [Yol haritası](#yol-haritası).

## Mimari

```
Tarayıcı (Next.js)  Builder | Görüşme | İstek logu + metrikler
        │  SSE (yazılı)          │ WebRTC (sesli, Faz 3)
        ▼                        ▼
Next.js API routes          LiveKit Agents worker (Node, Faz 3)
  /api/agents  ── Task Guard (Katman 1 kurallar → Katman 2 LLM sınıflandırıcı)
  /api/chat    ── Agent runtime: config → system prompt (+ sabit güvenlik bloğu) → AI SDK streamText
  /api/admin   ── inceleme, örnekler, temizlik
        │
        ▼
Postgres (Supabase)  agents · sessions · messages · action_logs · usage_limits · safety_events
(DATABASE_URL yoksa yerelde gömülü PGlite)
```

```
packages/core   Saf TypeScript, test edilebilir: config şeması, şablonlar, prompt üretimi,
                Task Guard, log maskeleme, sağlayıcı kataloğu + fiyatlar. Web ve ses worker'ı ortak kullanır.
apps/web        Next.js 16 (App Router) + Tailwind v4 + Drizzle ORM + Vercel AI SDK v7
```

### Neden bu stack

- **Next.js + API routes:** Tek deploy (Vercel), SSE streaming yerleşik. Uzun ömürlü ses bağlantısı Next'te değil, ayrı worker'da.
- **Vercel AI SDK:** Anthropic / OpenAI / Google için tek arayüz (adapter), streaming ve tool calling ortak. Yeni LLM = katalog satırı + `lib/llm.ts` içinde bir `case`.
- **LiveKit Agents (Vapi yerine):** Açık kaynak; sağlayıcılar oturum başına koddan seçilir (dispatch metadata → worker `AgentSession`'ı istenen STT/LLM/TTS ile kurar). VAD, turn detection, kesme (barge-in) ve katman bazlı metrik olayları hazır. Vapi'de sağlayıcı kataloğu ve metrikler platforma bağlı, tool çağrıları public webhook ister ve dakika başı platform ücreti ekler. Realtime (speech-to-speech) için OpenAI Realtime / Gemini Live doğrudan tarayıcıdan kısa ömürlü token ile.
- **Postgres (Supabase):** JSONB config, cascade silme, KVKK temizliği için basit tarih sorguları.

## Kurulum

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # anahtarları doldur
pnpm dev                                        # http://localhost:3000
pnpm test                                       # core testleri (Task Guard senaryoları dahil)
```

Anahtarsız denemek için `.env.local` içine `DEV_MOCK_LLM=1` yazın: tüm LLM çağrıları sahte bir modele gider (production'da çalışmaz).

Örnek agent'lar: `/admin` sayfasında `ADMIN_KEY` ile giriş yapıp **Örnek agent'ları ekle**. İçerikleri `apps/web/seeds/demo-agents.json` dosyasında; kodda işletme verisi yok.

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Postgres bağlantısı (Supabase "Transaction pooler"). Boşsa `./.data` içinde PGlite. Tablolar ilk istekte otomatik oluşur. |
| `ADMIN_KEY` | Yönetici modu: limitsiz kullanım, inceleme paneli. |
| `IP_HASH_SALT` | IP'ler yalnızca tuzlu hash olarak saklanır. |
| `RETENTION_DAYS` | Görüşme ve logların saklanma süresi (varsayılan 7). |
| `CRON_SECRET` | `GET /api/cron/cleanup` için `Authorization: Bearer …`. Günlük çalıştırın (Vercel Cron vb.). |
| `DAILY_SESSIONS_PER_IP`, `DAILY_PREMIUM_SESSIONS_PER_IP`, `MAX_MESSAGES_PER_SESSION` | Kötüye kullanım limitleri (20 / 3 / 40). |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | En az biri. Güvenlik sınıflandırıcısı da bunlardan birini kullanır. |
| `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY`, `LIVEKIT_*`, `TURNSTILE_*` | Sesli mod (Faz 3+). |

> **Harcama limiti:** Her sağlayıcının panelinde aylık harcama limitini ayrıca ayarlayın. Uygulama içi limitler yalnızca ilk savunma hattıdır.

Anahtarlar yalnızca sunucuda okunur; `/api/providers` sadece "anahtar var/yok" bilgisini döner.

## Güvenlik (Task Guard)

Felsefe: kişilik ve ton serbest (küfürlü vergi danışmanı çalışır), gerçek zarar engellenir.

| Katman | Nerede | Ne yapar |
|---|---|---|
| 1. Kurallar | `packages/core/src/guard.ts` | İşlem/parametre adlarında hassas alan (`card_number`, `kartNo`, `cvv`, `iban`, `sifre`, `pin`, `tckn`, `otp`, `sms_kodu`…) ve metinde "hassas veri + toplama fiili" kalıbı → kaydedilmez. Olumsuz cümleler ("asla şifre isteme") engellenmez. Gerçek kurum adı + "müşteri hizmetleri/hesap doğrulama" kalıbı şüphe olarak Katman 2'ye not düşer. |
| 2. LLM sınıflandırıcı | `runTaskGuard` + `lib/safety.ts` | Tüm config küçük bir modele gider: `allow / warn / block` + kategori. `ok_profanity_persona` engel değil, "argo içerebilir" uyarısını açar. `warn` → kaydedilir, paylaşım kapalı, admin onayı bekler. Sınıflandırıcı hata verir veya saçma dönerse **kaydedilmez**. |
| 3. Çalışma zamanı | `prompt.ts`, `runtime-guard.ts`, `mask.ts` | System prompt'un başında değiştirilemez güvenlik bloğu. Prompt injection denemeleri `safety_events`'e yazılır. Yanıt hassas veri isterse güvenli metinle değiştirilir. Kart (Luhn), IBAN, TCKN (checksum) ve telefon yazılmadan önce maskelenir. |
| 4. Paylaşım | `/a/:slug`, `/admin` | Link yalnızca `allow` agent'larda açık. "Bildir" linki anında dondurur. Bir saatte 5 reddedilen deneme yapan IP geçici olarak kısıtlanır. |

Test seti: `packages/core/test/guard-scenarios.ts` — 18 senaryo (9 reddedilmeli, 9 geçmeli). Katman 1'in yakalaması gereken her şey ve **tüm zararsız agent'larda yanlış pozitif olmaması** otomatik test edilir.

## Yeni sağlayıcı eklemek

1. `packages/core/src/catalog.ts` içine model satırı (id `sağlayıcı:model`, fiyat, env anahtarı).
2. LLM ise `apps/web/src/lib/llm.ts` içindeki `switch`'e bir `case`. (Ses sağlayıcıları Faz 3'te worker tarafında aynı desenle.)

Fiyatlar tek dosyada (`catalog.ts`) durur; "estimate — verify" notlu olanları kendi panelinizden doğrulayın.

## Yol haritası

- [x] **Faz 1** — Config modeli, builder formu, 5 şablon, config → system prompt, ham JSON/prompt düzenleme, yazılı chat (streaming), katman bazlı gecikme şeridi, maliyet tahmini, "başka modelle dene", paylaşım linki.
- [x] **Faz 2** — Task Guard (4 katman), sabit güvenlik bloğu, log maskeleme, IP başına günlük limit (büyük modellere daha sıkı), mesaj limiti, admin modu ve inceleme paneli, KVKK temizliği.
- [ ] **Faz 3** — Sesli mod (pipeline): LiveKit worker, streaming STT → LLM → TTS, turn detection, dolgu cümleleri, Turnstile, KVKK onayı, 3 dk süre limiti.
- [ ] **Faz 4** — Çoklu STT/TTS + ses önizleme, realtime modu, sesli metrik paneli.
- [ ] **Faz 5** — İşlem düzenleyici (form → JSON Schema), Action Simulator (`simulate` / `static` / `manual`), canlı istek logu, parametre doğrulama, onay akışı, "hata döndür".
- [ ] **Faz 6** — Karşılaştırma tablosu, transcript indirme cilası, demo video/GIF, case study.

Tasarım notları: [`docs/DESIGN.md`](docs/DESIGN.md) (Anthropic `frontend-design` skill'i ile; skill `.claude/skills/frontend-design` altında repoda).
