"use client";

import { useMemo, useState } from "react";
import { agentConfigSchema, buildPersonaPrompt, buildSystemPrompt, type AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";
import { ModelPicker, SelectRow } from "./ModelPicker";
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
}: {
  section: Section;
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  providers: ProviderAvailability | null;
}) {
  const set = (fn: (d: AgentConfig) => void) => {
    const draft = structuredClone(config);
    fn(draft);
    onChange(draft);
  };

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-7 px-4 py-6 sm:px-6 sm:py-8">
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
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set((d) => void (d.persona.tone = t))}
                  className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${config.persona.tone === t ? "bg-label text-surface" : "bg-fill text-label hover:bg-fill-strong"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Group>
          <Group title="Konuşma" foot="Kullanıcı başka bir dilde konuşursa agent onun diline geçer. Kısa cevaplar seste daha doğal duyulur ve gecikmeyi azaltır.">
            <SelectRow id="lang" label="Dil" value={config.persona.language} options={LANGS.map(([id, label]) => ({ id, label, available: true }))} onChange={(v) => set((d) => void (d.persona.language = v))} />
            <div className="row">
              <span className="label flex-1">Cevap uzunluğu</span>
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
            <label className="cursor-pointer text-[13px] font-medium text-needle-ink hover:underline">
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
          {config.actions.length === 0 && <p className="row text-secondary">Bu agent için tanımlı işlem yok.</p>}
          {config.actions.map((a) => (
            <div key={a.name} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <code className="font-mono text-[13.5px] font-medium">{a.name}</code>
                <span className="text-[12px] text-secondary">
                  {a.response_mode}
                  {a.requires_confirmation ? ", onay ister" : ""}
                </span>
              </div>
              <p className="mt-0.5 text-[14px] text-secondary">{a.description}</p>
              {a.params.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {a.params.map((p) => (
                    <span key={p.name} className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-[11.5px] text-secondary">
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
            <p className="group-title">Ses kombinasyonu</p>
            <ModelPicker idPrefix="def" value={config.providers} providers={providers} onChange={(v) => set((d) => void (d.providers = v))} />
            <p className="group-foot">
              {providers.voice
                ? "Pipeline modunda her katmanı ayrı seçersiniz ve gecikme katman katman ölçülür. Realtime modunda tek model hem dinler hem konuşur; genelde daha hızlıdır, kontrolü daha azdır."
                : "Sesli mod için sunucuda LiveKit ayarları eksik. Modeller seçilebilir ama görüşme başlatılamaz."}
            </p>
          </div>
        ) : (
          <p className="text-secondary">Sağlayıcılar yükleniyor…</p>
        ))}

      {section === "advanced" && <AdvancedSection config={config} onChange={onChange} />}
    </div>
  );
}

export function Group({ title, foot, action, children }: { title?: string; foot?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      {(title || action) && (
        <div className="mb-1.5 flex items-baseline justify-between px-4">
          {title && <h3 className="text-[13px] font-medium text-secondary">{title}</h3>}
          {action}
        </div>
      )}
      <div className="group-list">{children}</div>
      {foot && <p className="group-foot">{foot}</p>}
    </section>
  );
}

function InputRow({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label htmlFor={id} className="row cursor-text">
      <span className="label w-28 shrink-0 sm:w-32">{label}</span>
      <input id={id} className="field-bare text-right text-secondary focus:text-label" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextRow({ id, label, value, onChange, rows, placeholder }: { id: string; label?: string; value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <div className="px-4 py-2.5">
      {label && (
        <label htmlFor={id} className="mb-1 block text-[13px] text-secondary">
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className="field-bare resize-y" value={value} placeholder={placeholder} aria-label={label} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Stepper({ value, min, max, onChange, format }: { value: number; min: number; max: number; onChange: (n: number) => void; format: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[15px] tabular-nums text-secondary">{format(value)}</span>
      <div className="flex overflow-hidden rounded-[7px] bg-fill">
        <button type="button" aria-label="Azalt" disabled={value <= min} onClick={() => onChange(value - 1)} className="px-3 py-1 text-[17px] leading-none disabled:opacity-30">
          −
        </button>
        <span className="my-1.5 w-px bg-separator" />
        <button type="button" aria-label="Artır" disabled={value >= max} onClick={() => onChange(value + 1)} className="px-3 py-1 text-[17px] leading-none disabled:opacity-30">
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
        <div className="row">
          <label htmlFor="override" className="label flex-1">
            Elle düzenle
          </label>
          <Switch id="override" label="Prompt'u elle düzenle" checked={overriding} onChange={(v) => onChange({ ...config, prompt_override: v ? generated : undefined })} />
        </div>
        {overriding ? (
          <div className="px-4 py-2.5">
            <textarea rows={14} aria-label="Prompt" className="field-bare resize-y font-mono text-[12.5px] leading-5" value={config.prompt_override} onChange={(e) => onChange({ ...config, prompt_override: e.target.value })} />
          </div>
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-5 text-secondary">{full}</pre>
        )}
      </Group>

      <Group
        title="Ham JSON"
        foot={rawError ? <span className="text-end">{rawError}</span> : "Tanımın tamamı. Uygulamadan önce doğrulanır."}
        action={
          <button
            type="button"
            className="text-[13px] font-medium text-needle-ink hover:underline"
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
        <div className="px-4 py-2.5">
          <textarea
            rows={14}
            aria-label="Ham JSON"
            className="field-bare resize-y font-mono text-[12.5px] leading-5"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onFocus={() => setRaw(JSON.stringify(config, null, 2))}
          />
        </div>
      </Group>
    </>
  );
}
