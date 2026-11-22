"use client";

import { createContext, useContext, useMemo, useState } from "react";

/** Inside the settings sheet groups drop their card: the accordion already frames them. */
const CompactCtx = createContext(false);
import { agentConfigSchema, buildPersonaPrompt, buildSystemPrompt, type AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import { ModelPicker, Select } from "./ModelPicker";
import { Switch } from "./ui/Switch";

export type Section = "task" | "persona" | "knowledge" | "actions" | "models" | "advanced";

export const SECTION_TITLES: Record<Section, string> = {
  task: "Görev",
  persona: "Kişilik",
  knowledge: "Bilgi",
  actions: "İşlemler",
  models: "Modeller",
  advanced: "Gelişmiş",
};

const SECTION_HELP: Record<Section, string> = {
  task: "Agent kim, hangi şirketi temsil ediyor ve ne yapıyor? Buraya yazdıklarınız agent'ın talimatı olur.",
  persona: "Nasıl konuştuğu: ton, dil ve cevap uzunluğu. Sert veya esprili karakterler serbest.",
  knowledge: "Agent'ın bilmesi gerekenler: fiyatlar, saatler, sık sorulan sorular. Burada olmayanı uydurmaz.",
  actions: "Agent'ın görüşmede tetikleyebileceği işlemler, ör. randevu oluşturma. Gerçek bir sisteme bağlanmaz, simüle edilir.",
  models: "Konuşmanın izlediği güzergâh: sesi yazıya çeviren, cevabı yazan ve seslendiren modeller.",
  advanced: "Üretilen sistem prompt'u ve agent tanımının ham JSON hali. Deneyimli kullanıcılar için.",
};

const TONES = ["samimi", "resmi", "esprili", "sert", "sakin", "enerjik"];
const LANGS: [string, string][] = [
  ["tr", "Türkçe"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["es", "Español"],
  ["ar", "العربية"],
];

/** One definition section, rendered as inset grouped lists (System Settings). */
export function DefinitionSection({
  section,
  config,
  onChange,
  providers,
  compact = false,
}: {
  section: Section;
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  providers: ProviderAvailability | null;
  /** Inside the settings sheet: no page heading, no page padding. */
  compact?: boolean;
}) {
  const set = (fn: (d: AgentConfig) => void) => {
    const draft = structuredClone(config);
    fn(draft);
    onChange(draft);
  };

  return (
    <CompactCtx.Provider value={compact}>
    <div className={compact ? "space-y-5" : "mx-auto w-full max-w-[640px] space-y-7 px-4 py-6 sm:px-6 sm:py-8"}>
      {compact ? (
        <p className="text-xs leading-5 text-muted-foreground">{SECTION_HELP[section]}</p>
      ) : (
        <div>
          <h2 className="text-[24px] font-bold leading-8">{SECTION_TITLES[section]}</h2>
          <p className="mt-1 max-w-[60ch] text-[15px] leading-[23px] text-ink-2">{SECTION_HELP[section]}</p>
        </div>
      )}
      {section === "task" && (
        <>
          <Group title="Agent">
            <InputRow id="name" label="Ad" value={config.name} onChange={(v) => set((d) => void (d.name = v))} placeholder="Ör. Resepsiyonist" />
            <InputRow id="greet" label="İlk cümle" value={config.greeting} onChange={(v) => set((d) => void (d.greeting = v))} placeholder="Merhaba, nasıl yardımcı olabilirim?" />
          </Group>
          <Group title="Şirket" foot="Agent'ın temsil ettiği işletme. Boş bırakılabilir; agent sadece buraya ve Bilgi bölümüne yazılanları bilir.">
            <InputRow id="company" label="Şirket adı" value={config.company.name} onChange={(v) => set((d) => void (d.company.name = v))} placeholder="İsteğe bağlı" />
            <TextRow id="cdesc" label="Hakkında" rows={2} value={config.company.description} onChange={(v) => set((d) => void (d.company.description = v))} />
            <TextRow id="cinfo" label="Adres, saatler, kurallar" rows={3} value={config.company.info} onChange={(v) => set((d) => void (d.company.info = v))} />
          </Group>
          <Group title="Görev tanımı" foot="Ne yapar, neyi yapmaz, hedefi ne? Agent bu metni talimat olarak alır.">
            <TextRow id="role" rows={6} value={config.role} onChange={(v) => set((d) => void (d.role = v))} placeholder="Müşterileri karşıla, randevu al…" />
          </Group>
        </>
      )}

      {section === "persona" && (
        <>
          <Group foot="Serbest yazabilirsiniz: “alaycı ama yardımsever”, “küfürlü vergi danışmanı”…">
            <InputRow id="tone" label="Ton" value={config.persona.tone} onChange={(v) => set((d) => void (d.persona.tone = v))} />
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set((d) => void (d.persona.tone = t))}
                  aria-pressed={config.persona.tone === t}
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors duration-150 ${
                    config.persona.tone === t ? "border-ink bg-ink text-surface" : "border-line text-ink-2 hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Group>
          <Group title="Konuşma" foot="Kullanıcı başka bir dilde konuşursa agent onun diline geçer. Kısa cevaplar seste daha doğal duyulur ve gecikmeyi azaltır.">
            <div>
              <label htmlFor="lang" className="mb-1.5 block text-sm font-medium">
                Dil
              </label>
              <Select id="lang" label="Dil" value={config.persona.language} options={LANGS.map(([id, label]) => ({ id, label, available: true }))} onChange={(v) => set((d) => void (d.persona.language = v))} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[14px] font-semibold">Cevap uzunluğu</span>
              <Stepper
                value={config.limits.max_reply_sentences}
                min={1}
                max={6}
                onChange={(n) => set((d) => void (d.limits.max_reply_sentences = n))}
                format={(n) => `en fazla ${n} cümle`}
              />
            </div>
          </Group>
          <Group title="Üslup notları">
            <TextRow id="style" rows={4} value={config.persona.style_notes} onChange={(v) => set((d) => void (d.persona.style_notes = v))} placeholder="Ör. Müşteriye adıyla hitap et." />
          </Group>
        </>
      )}

      {section === "knowledge" && (
        <Group
          title="Bilgi metni"
          foot={`SSS, fiyat listesi, politika… ${config.knowledge.length.toLocaleString("tr-TR")} / 30.000 karakter.`}
          action={
            <label className="cursor-pointer text-[13px] font-semibold text-link hover:underline">
              Dosyadan ekle
              <input
                type="file"
                accept=".txt,.md,.csv,text/plain"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await f.text();
                  set((d) => void (d.knowledge = (d.knowledge ? d.knowledge + "\n\n" : "") + text.slice(0, 30000)));
                }}
              />
            </label>
          }
        >
          <TextRow id="kb" rows={18} value={config.knowledge} onChange={(v) => set((d) => void (d.knowledge = v))} placeholder="Agent'ın bilmesi gereken her şeyi buraya yapıştırın." />
        </Group>
      )}

      {section === "actions" && (
        <Group title="Tanımlı işlemler" foot="İşlem düzenleyici ve simülatör sıradaki adımda geliyor. Şimdilik şablondaki işlem tanımları kaydedilir ama agent görüşmede bunları çağırmaz.">
          {config.actions.length === 0 && <p className="text-ink-2">Bu agent için tanımlı işlem yok.</p>}
          {config.actions.map((a) => (
            <div key={a.name} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <code className="font-mono text-[13.5px] font-medium">{a.name}</code>
                <span className="text-[12px] text-ink-3">
                  {a.response_mode}
                  {a.requires_confirmation ? ", onay ister" : ""}
                </span>
              </div>
              <p className="mt-0.5 text-[14px] text-ink-2">{a.description}</p>
              {a.params.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.params.map((p) => (
                    <span key={p.name} className="rounded-[4px] border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink-2">
                      {p.name}
                      {p.required ? "" : "?"}: {p.type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Group>
      )}

      {section === "models" &&
        (providers ? (
          <div>
            <h3 className="group-title">Güzergâh</h3>
            <div className="rounded-[8px] border border-line bg-surface p-4 sm:p-5">
            <ModelPicker
              idPrefix="def"
              value={config.providers}
              providers={providers}
              language={config.persona.language}
              sampleText={sample(config)}
              onChange={(v) => set((d) => void (d.providers = v))}
            />
            </div>
            <p className="group-foot">
              {providers.voice
                ? "Aktarmalı güzergâhta üç modeli ayrı seçersiniz ve gecikme durak durak ölçülür. Ekspres (realtime) modelde tek model hem dinler hem konuşur; genelde daha hızlıdır, ama durakları ayrı ölçemezsiniz."
                : "Sesli mod için sunucuda LiveKit ayarları eksik. Modeller seçilebilir ama görüşme başlatılamaz."}
            </p>
          </div>
        ) : (
          <p className="text-ink-2">Sağlayıcılar yükleniyor…</p>
        ))}

      {section === "advanced" && <AdvancedSection config={config} onChange={onChange} />}
    </div>
    </CompactCtx.Provider>
  );
}

/** Voice previews say the agent's real greeting when there is one. */
export function sample(config: AgentConfig) {
  const g = config.greeting.trim();
  if (g) return g.slice(0, 200);
  return config.persona.language === "tr" ? `Merhaba, ben ${config.name || "asistanınız"}. Size nasıl yardımcı olabilirim?` : `Hi, I'm ${config.name || "your assistant"}. How can I help you today?`;
}

export function Group({ title, foot, action, children }: { title?: string; foot?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  const compact = useContext(CompactCtx);
  return (
    <section>
      {(title || action) && (
        <div className="mb-2 flex items-baseline justify-between">
          {title && <h3 className={compact ? "font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase" : "text-[15px] font-bold"}>{title}</h3>}
          {action}
        </div>
      )}
      <div className={compact ? "space-y-4" : "space-y-4 rounded-[8px] border border-line bg-surface p-4 sm:p-5"}>{children}</div>
      {foot && <p className="group-foot">{foot}</p>}
    </section>
  );
}

function InputRow({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextRow({ id, label, value, onChange, rows, placeholder }: { id: string; label?: string; value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className="field resize-y" value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stepper({ value, min, max, onChange, format }: { value: number; min: number; max: number; onChange: (n: number) => void; format: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[15px] text-ink-2">{format(value)}</span>
      <div className="flex overflow-hidden rounded-[6px] border border-line">
        <button type="button" aria-label="Azalt" disabled={value <= min} onClick={() => onChange(value - 1)} className="px-3 py-1 text-[17px] leading-none hover:bg-surface-2 disabled:opacity-30">
          −
        </button>
        <span className="w-px bg-line" />
        <button type="button" aria-label="Artır" disabled={value >= max} onClick={() => onChange(value + 1)} className="px-3 py-1 text-[17px] leading-none hover:bg-surface-2 disabled:opacity-30">
          +
        </button>
      </div>
    </div>
  );
}

function AdvancedSection({ config, onChange }: { config: AgentConfig; onChange: (c: AgentConfig) => void }) {
  const generated = useMemo(() => buildPersonaPrompt(config), [config]);
  const full = useMemo(() => buildSystemPrompt(config), [config]);
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);
  const overriding = config.prompt_override !== undefined;

  return (
    <>
      <Group title="Sistem prompt'u" foot="En baştaki güvenlik kuralları her zaman eklenir ve düzenlenemez. Elle düzenleme yalnızca altındaki kısmı değiştirir.">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="override" className="text-[14px] font-semibold">
            Elle düzenle
          </label>
          <Switch id="override" label="Prompt'u elle düzenle" checked={overriding} onChange={(v) => onChange({ ...config, prompt_override: v ? generated : undefined })} />
        </div>
        {overriding ? (
          <div>
            <textarea rows={14} aria-label="Prompt" className="field resize-y font-mono text-[12.5px] leading-5" value={config.prompt_override} onChange={(e) => onChange({ ...config, prompt_override: e.target.value })} />
          </div>
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[6px] bg-surface-2 px-3.5 py-3 font-mono text-[12px] leading-5 text-ink-2">{full}</pre>
        )}
      </Group>

      <Group
        title="Ham JSON"
        foot={rawError ? <span className="text-danger">{rawError}</span> : "Tanımın tamamı. Uygulamadan önce doğrulanır."}
        action={
          <button
            type="button"
            className="btn-quiet py-1 text-[13px]"
            onClick={() => {
              try {
                const parsed = agentConfigSchema.safeParse(JSON.parse(raw));
                if (!parsed.success) {
                  setRawError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
                  return;
                }
                setRawError(null);
                onChange(parsed.data);
              } catch {
                setRawError("JSON okunamadı.");
              }
            }}
          >
            Uygula
          </button>
        }
      >
        <div>
          <textarea
            rows={14}
            aria-label="Ham JSON"
            className="field resize-y font-mono text-[12.5px] leading-5"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onFocus={() => setRaw(JSON.stringify(config, null, 2))}
          />
        </div>
      </Group>
    </>
  );
}
