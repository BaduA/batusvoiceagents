# Voice Agent Playground

Herhangi bir şirket ve görev için **sesli** bir AI agent'ı birkaç dakikada tanımla, ses modellerini seç, mikrofona konuşarak test et ve linkini gönder. Görüşmede yazı kutusu yoktur: agent sesle cevap verir, ekranda yalnızca konuşmanın canlı transkripti ve ölçümler görünür.

**Problem:** Freelance AI-agent tekliflerinde "yapabilirim" demek yetmiyor. **Çözüm:** İşverenin görevini bu playground'a tanımla, konuşulabilen bir demo linki gönder. Her cevabın kaç milisaniyede geldiği, neye mal olduğu ve agent'ın tetiklediği (simüle) işlemler görünür.

> Durum: Builder, güvenlik/limitler ve **sesli görüşme (pipeline + realtime, LiveKit)** hazır. İşlem simülatörü ve ses önizleme sırada. Ayrıntı: [Yol haritası](#yol-haritası).

## Mimari

```
Tarayıcı (Next.js)   Builder | Görüşme (mikrofon + canlı transkript) | Ölçümler
   │ HTTPS: kaydet, /api/voice/start (onay + Turnstile + limit → kısa ömürlü token)
   │ WebRTC ses + transkript + "vap" veri kanalı (gecikme, uyarılar)
   ▼
LiveKit (Cloud veya self-host) ── açık dispatch: "vap-agent" ──►  Voice worker (apps/voice-worker)
                                                                  │ boot: GET /api/internal/voice/:session
                                                                  │ VAD + turn detection (çok dilli)
                                                                  │ STT → LLM → TTS  veya  Realtime model
                                                                  │ olaylar: transkript, katman gecikmeleri,
                                                                  │ güvenlik, bitiş + kullanım → /events
Next.js API routes ◄──────────────────────────────────────────────┘
  /api/agents   Task Guard (Katman 1 kurallar → Katman 2 LLM sınıflandırıcı)
  /api/voice    oturum, token, süre/IP limitleri;  /api/internal/voice  worker uçları (paylaşılan sır)
Postgres (Supabase)  agents · sessions(turn_metrics, usage) · messages · action_logs · usage_limits · safety_events
```

```
packages/core       Saf TypeScript: config şeması, şablonlar, prompt üretimi (+ sabit güvenlik bloğu),
                    Task Guard, maskeleme, sağlayıcı kataloğu + fiyatlar. Web ve worker ortak kullanır.
apps/web            Next.js 16 + Tailwind v4 + Drizzle + Vercel AI SDK v7 (sınıflandırıcı) + LiveKit React
apps/voice-worker   LiveKit Agents (Node) worker: sağlayıcı adaptörleri (models.ts), metrikler, süre limiti
```

### Neden bu stack

- **LiveKit Agents (Vapi yerine):** Açık kaynak, kod bizde. Sağlayıcılar görüşme başına seçilir: token içindeki dispatch → worker web'den config'i çeker → `AgentSession`'ı istenen STT/LLM/TTS veya realtime modelle kurar. VAD, çok dilli konuşma-sonu modeli, araya girme (barge-in), önden üretim ve katman bazlı metrikler hazır gelir. **LiveKit Inference** sayesinde Deepgram, Cartesia, OpenAI ve Gemini modelleri tek LiveKit anahtarıyla çalışır; istenirse her sağlayıcının kendi anahtarı kullanılır. Vapi'de sağlayıcı kataloğu ve metrikler platforma bağlıdır, işlemler public webhook ister ve dakika başı platform ücreti eklenir.
- **Next.js:** Builder + API tek deploy (Vercel). Uzun ömürlü ses bağlantısı Next'te değil, worker'da (Fly.io, Railway veya LiveKit Cloud Agents).
- **Postgres (Supabase):** JSONB config ve metrikler, cascade silme, KVKK temizliği.

### Gecikme nasıl ölçülür

Her agent cevabı için worker üç katmanı ölçer ve hem ekrana (veri kanalı) hem veritabanına (`sessions.turn_metrics`) yazar: konuşma sonu → tur onayı (STT finalizasyonu dahil), LLM ilk token, TTS ilk ses. Toplamları **ilk ses** gecikmesidir ve her cevabın altındaki şeritte ölçekli gösterilir. Önden üretim ve çok dilli turn detector ile hedef 0,7–1,5 sn.

## Kurulum

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local          # LiveKit + INTERNAL_API_SECRET + bir LLM anahtarı
cp apps/voice-worker/.env.example apps/voice-worker/.env
pnpm worker:download-files                            # VAD + çok dilli turn detector modelleri (bir kez)
pnpm dev                                              # web: http://localhost:3000
pnpm dev:worker                                       # ses worker'ı (ayrı terminal)
pnpm test                                             # core testleri (Task Guard senaryoları dahil)
```

En hızlı yol: bir **LiveKit Cloud** projesi aç, URL/anahtar/sırrı iki `.env` dosyasına yaz. Deepgram, Cartesia ve OpenAI modelleri LiveKit Inference üzerinden ek anahtar gerektirmeden çalışır. Claude modelleri ve ElevenLabs için ilgili anahtarı worker'ın `.env`'ine ekle.

Tamamen yerel deneme: `livekit-server --dev` (ws://localhost:7880, `devkey` / `secret`). Bu durumda LiveKit Inference yoktur; STT/LLM/TTS için sağlayıcıların kendi anahtarları gerekir.

Örnek agent'lar: `/admin` sayfasında `ADMIN_KEY` ile giriş yapıp **Örnek agent'ları ekle**. İçerikleri `apps/web/seeds/demo-agents.json` dosyasındadır; kodda işletme verisi yoktur.

Geliştirme için `DEV_MOCK_LLM=1`: Task Guard sınıflandırıcısı sahte bir modelle çalışır (production'da kapalıdır). Ses tarafında mock yoktur.

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | Postgres bağlantısı (Supabase "Transaction pooler"). Boşsa `./.data` içinde PGlite. Tablolar ilk istekte otomatik oluşur. |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Ses odası ve token üretimi (web + worker). |
| `LIVEKIT_INFERENCE` | LiveKit Inference modelleri; `*.livekit.cloud` adreslerinde otomatik açık. |
| `INTERNAL_API_SECRET` | Worker ↔ web arası paylaşılan sır (iki tarafta aynı). |
| `MAX_VOICE_SECONDS` | Görüşme başına süre limiti (varsayılan 180). Worker son 15 sn'de uyarır, sonra kapatır. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Görüşme başlamadan Cloudflare Turnstile bot kontrolü. |
| `ADMIN_KEY` | Yönetici modu: limitsiz kullanım (30 dk görüşme), inceleme paneli. |
| `IP_HASH_SALT` | IP'ler yalnızca tuzlu hash olarak saklanır. |
| `RETENTION_DAYS` | Görüşme ve logların saklanma süresi (varsayılan 7). |
| `CRON_SECRET` | `GET /api/cron/cleanup` için `Authorization: Bearer …`. Günlük çalıştır (Vercel Cron vb.). |
| `DAILY_SESSIONS_PER_IP`, `DAILY_PREMIUM_SESSIONS_PER_IP` | Günlük görüşme limiti (20 / büyük modellerde 3). |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | Web: en az biri (Task Guard sınıflandırıcısı). Worker: o modelleri kendi anahtarınla çalıştırmak için. |
| `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `ELEVENLABS_API_KEY` | İsteğe bağlı; yoksa LiveKit Inference. |
| Worker: `WEB_BASE_URL`, `TURN_DETECTION` | Web adresi; `multilingual` (önerilen) / `vad` / `stt`. |

> **Harcama limiti:** Her sağlayıcının (ve LiveKit'in) panelinde aylık harcama limitini ayrıca ayarla. Uygulama içi limitler yalnızca ilk savunma hattıdır.

Anahtarlar yalnızca sunucuda ve worker'da okunur. Tarayıcı yalnızca 10 dakikalık, tek odaya bağlı bir LiveKit token'ı alır; `/api/providers` sadece "çalışır / çalışmaz" bilgisini döner.

## Güvenlik (Task Guard)

Felsefe: kişilik ve ton serbest (küfürlü vergi danışmanı çalışır), gerçek zarar engellenir. Ses klonlama yoktur: yalnızca sağlayıcıların hazır sesleri.

| Katman | Nerede | Ne yapar |
|---|---|---|
| 1. Kurallar | `packages/core/src/guard.ts` | İşlem/parametre adlarında hassas alan (`card_number`, `kartNo`, `cvv`, `iban`, `sifre`, `pin`, `tckn`, `otp`, `sms_kodu`…) ve metinde "hassas veri + toplama fiili" kalıbı → kaydedilmez. Olumsuz cümleler ("asla şifre isteme") engellenmez. Gerçek kurum adı + "müşteri hizmetleri/hesap doğrulama" kalıbı şüphe olarak Katman 2'ye not düşer. |
| 2. LLM sınıflandırıcı | `runTaskGuard` + `lib/safety.ts` | Tüm config küçük bir modele gider: `allow / warn / block` + kategori. `ok_profanity_persona` engel değil, "argo içerebilir" uyarısını açar. `warn` → kaydedilir, paylaşım kapalı, admin onayı bekler. Sınıflandırıcı hata verir veya saçma dönerse **kaydedilmez**. |
| 3. Çalışma zamanı | `prompt.ts`, `runtime-guard.ts`, `mask.ts`, worker | System prompt'un başında değiştirilemez güvenlik bloğu (asıl koruma). Worker, prompt injection denemelerini ve hassas veri isteyen cevapları `safety_events`'e yazar. Transkriptte kart (Luhn), IBAN, TCKN (checksum) ve telefon veritabanına yazılmadan önce maskelenir. |
| 4. Paylaşım | `/a/:slug`, `/admin` | Link yalnızca `allow` agent'larda açık. "Bildir" linki anında dondurur. Bir saatte 5 reddedilen deneme yapan IP geçici olarak kısıtlanır. |

Test seti: `packages/core/test/guard-scenarios.ts` — 18 senaryo (9 reddedilmeli, 9 geçmeli). Katman 1'in yakalaması gereken her şey ve **tüm zararsız agent'larda yanlış pozitif olmaması** otomatik test edilir. Katman 2'ye kalan senaryolar (ör. yatırım dolandırıcılığı) gerçek bir LLM anahtarıyla ayrıca doğrulanmalıdır.

## Yeni sağlayıcı eklemek

1. `packages/core/src/catalog.ts` içine model satırı: id `sağlayıcı:model`, fiyat, env anahtarı, varsa LiveKit Inference adı, TTS için ses listesi.
2. `apps/voice-worker/src/models.ts` içinde ilgili `build*` fonksiyonuna bir `case` (LiveKit plugin'i ile).
3. Task Guard sınıflandırıcısında da kullanılacak bir LLM ise `apps/web/src/lib/llm.ts` içine bir `case`.

Fiyatlar tek dosyada (`catalog.ts`) durur; "estimate — verify" notlu olanları kendi panelinden doğrula.

## Yol haritası

- [x] Config modeli, builder formu, 5 şablon, config → system prompt, ham JSON/prompt düzenleme, paylaşım linki.
- [x] Task Guard (4 katman), sabit güvenlik bloğu, log maskeleme, IP başına günlük limit (büyük modellere daha sıkı), admin modu, KVKK temizliği.
- [x] **Sesli görüşme:** LiveKit worker, STT → LLM → TTS ve realtime modu, çok dilli turn detection, önden üretim, KVKK onayı + Turnstile, süre limiti, canlı transkript, katman bazlı gecikme şeridi, maliyet tahmini, "başka modellerle dene".
- [ ] Ses önizleme butonu ve sağlayıcı API'sinden ses listesi.
- [ ] İşlem düzenleyici (form → JSON Schema), Action Simulator (`simulate` / `static` / `manual`), canlı istek logu, parametre doğrulama, onay akışı, "hata döndür", işlem sırasında dolgu cümlesi.
- [ ] Karşılaştırma tablosu, demo video/GIF, case study.

Tasarım notları: [`docs/DESIGN.md`](docs/DESIGN.md) (Anthropic `frontend-design` skill'i ile; skill `.claude/skills/frontend-design` altında repoda).
