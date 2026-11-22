"use client";

import { useMemo, useState } from "react";
import { buildPersonaPrompt, buildSystemPrompt, agentConfigSchema, type AgentConfig } from "@vap/core";
import type { ProviderAvailability } from "@/lib/providers";

type Tab = "task" | "persona" | "knowledge" | "actions" | "models" | "advanced";

const TABS: { id: Tab; label: string }[] = [
  { id: "task", label: "Görev" },
  { id: "persona", label: "Kişilik" },
  { id: "knowledge", label: "Bilgi" },
  { id: "actions", label: "İşlemler" },
  { id: "models", label: "Modeller" },
  { id: "advanced", label: "Gelişmiş" },
];

const TONES = ["samimi", "resmi", "esprili", "sert", "sakin", "enerjik"];
const LANGS: [string, string][] = [
  ["tr", "Türkçe"],
  ["en", "English"],
  ["de", "Deutsch"],
  ["fr", "Français"],
  ["es", "Español"],
  ["ar", "العربية"],
];

export function DefinitionPanel({
  config,
  onChange,
  providers,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  providers: ProviderAvailability | null;
}) {
  const [tab, setTab] = useState<Tab>("task");
  const set = (fn: (d: AgentConfig) => void) => {
    const draft = structuredClone(config);
    fn(draft);
    onChange(draft);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="Agent tanımı" className="flex gap-x-0.5 overflow-x-auto whitespace-nowrap border-b border-rule px-3 pt-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-2 pb-2 pt-1 text-[14px] font-medium ${
              tab === t.id ? "border-needle text-ink" : "border-transparent text-graphite hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "actions" && config.actions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-desk px-1.5 text-[12px] text-graphite">{config.actions.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {tab === "task" && (
          <>
            <Field label="Agent adı" htmlFor="name">
              <input id="name" className="field" value={config.name} onChange={(e) => set((d) => void (d.name = e.target.value))} />
            </Field>
            <Field label="Şirket adı" htmlFor="company" hint="Agent'ın temsil ettiği işletme. Boş bırakılabilir.">
              <input id="company" className="field" value={config.company.name} onChange={(e) => set((d) => void (d.company.name = e.target.value))} />
            </Field>
            <Field label="Şirket hakkında" htmlFor="cdesc">
              <textarea id="cdesc" rows={2} className="field" value={config.company.description} onChange={(e) => set((d) => void (d.company.description = e.target.value))} />
            </Field>
            <Field label="Adres, saatler, kurallar" htmlFor="cinfo">
              <textarea id="cinfo" rows={3} className="field" value={config.company.info} onChange={(e) => set((d) => void (d.company.info = e.target.value))} />
            </Field>
            <Field label="Görev tanımı" htmlFor="role" hint="Ne yapar, neyi yapmaz, hedefi ne?">
              <textarea id="role" rows={5} className="field" value={config.role} onChange={(e) => set((d) => void (d.role = e.target.value))} />
            </Field>
            <Field label="İlk cümle" htmlFor="greet" hint="Görüşme bu cümleyle açılır.">
              <input id="greet" className="field" value={config.greeting} onChange={(e) => set((d) => void (d.greeting = e.target.value))} />
            </Field>
          </>
        )}

        {tab === "persona" && (
          <>
            <Field label="Ton" htmlFor="tone" hint="Serbest yazabilirsiniz: “alaycı ama yardımsever”, “küfürlü vergi danışmanı”…">
              <input id="tone" className="field" value={config.persona.tone} onChange={(e) => set((d) => void (d.persona.tone = e.target.value))} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set((d) => void (d.persona.tone = t))}
                    className={`rounded-full border px-2.5 py-0.5 text-[13px] ${config.persona.tone === t ? "border-ink bg-ink text-sheet" : "border-rule text-graphite hover:border-ink hover:text-ink"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Dil" htmlFor="lang" hint="Kullanıcı başka dilde konuşursa agent onun diline geçer.">
              <select id="lang" className="field" value={config.persona.language} onChange={(e) => set((d) => void (d.persona.language = e.target.value))}>
                {LANGS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Üslup notları" htmlFor="style">
              <textarea id="style" rows={4} className="field" value={config.persona.style_notes} onChange={(e) => set((d) => void (d.persona.style_notes = e.target.value))} />
            </Field>
            <Field label="Cevap uzunluğu" htmlFor="maxs" hint="Sesli görüşmede kısa cevaplar daha doğal duyulur.">
              <div className="flex items-center gap-3">
                <input
                  id="maxs"
                  type="range"
                  min={1}
                  max={6}
                  value={config.limits.max_reply_sentences}
                  onChange={(e) => set((d) => void (d.limits.max_reply_sentences = Number(e.target.value)))}
                  className="flex-1 accent-[var(--needle)]"
                />
                <span className="w-20 text-[14px] text-ink">en fazla {config.limits.max_reply_sentences} cümle</span>
              </div>
            </Field>
          </>
        )}

        {tab === "knowledge" && (
          <Field label="Bilgi metni" htmlFor="kb" hint="SSS, fiyat listesi, politika… Agent yalnızca buradaki ve şirket alanlarındaki bilgilere dayanır.">
            <textarea id="kb" rows={16} className="field font-[450]" value={config.knowledge} onChange={(e) => set((d) => void (d.knowledge = e.target.value))} />
            <label className="btn-quiet mt-2 cursor-pointer text-[14px]">
              Metin dosyası yükle (.txt, .md)
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
            <p className="hint">{config.knowledge.length.toLocaleString("tr-TR")} / 30.000 karakter</p>
          </Field>
        )}

        {tab === "actions" && <ActionsPreview config={config} />}

        {tab === "models" && <ModelsTab config={config} set={set} providers={providers} />}

        {tab === "advanced" && <AdvancedTab config={config} onChange={onChange} />}
      </div>
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function ActionsPreview({ config }: { config: AgentConfig }) {
  return (
    <div className="space-y-4">
      <p className="rounded-[var(--radius-field)] border border-needle/50 bg-needle-soft/60 px-3 py-2 text-[14px] leading-6">
        İşlem düzenleyici ve simülatör sonraki fazda geliyor. Şimdilik şablondaki işlem tanımları kaydedilir ama agent bunları çağırmaz.
      </p>
      {config.actions.length === 0 && <p className="text-[14px] text-graphite">Bu agent için tanımlı işlem yok.</p>}
      <ul className="divide-y divide-rule rounded-[var(--radius-panel)] border border-rule bg-white">
        {config.actions.map((a) => (
          <li key={a.name} className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <code className="font-mono text-[13px] text-ink">{a.name}</code>
              <span className="text-[12px] text-graphite">{a.response_mode}{a.requires_confirmation ? ", onay ister" : ""}</span>
            </div>
            <p className="mt-0.5 text-[14px] text-graphite">{a.description}</p>
            {a.params.length > 0 && (
              <p className="mt-1 font-mono text-[12px] text-graphite">
                {a.params.map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`).join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModelsTab({ config, set, providers }: { config: AgentConfig; set: (fn: (d: AgentConfig) => void) => void; providers: ProviderAvailability | null }) {
  if (!providers) return <p className="text-[14px] text-graphite">Sağlayıcılar yükleniyor…</p>;
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="label">Dil modeli (LLM)</legend>
        <div className="divide-y divide-rule rounded-[var(--radius-panel)] border border-rule bg-white">
          {providers.llm.map((m) => (
            <label key={m.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${m.available ? "" : "cursor-not-allowed opacity-55"}`}>
              <input
                type="radio"
                name="llm"
                disabled={!m.available}
                checked={config.providers.llm === m.id}
                onChange={() => set((d) => void (d.providers.llm = m.id))}
                className="accent-[var(--ink)]"
              />
              <span className="flex-1">
                <span className="block text-[15px] font-medium">{m.label}</span>
                <span className="block text-[12px] text-graphite">
                  ${m.inputPerM} / ${m.outputPerM} (1M token girdi / çıktı){m.tier === "premium" ? ", büyük model: günlük limit daha sıkı" : ""}
                </span>
              </span>
              {!m.available && <span className="text-[12px] text-graphite">anahtar yok</span>}
            </label>
          ))}
        </div>
        {providers.mock && <p className="hint">Geliştirme modu: tüm LLM çağrıları mock modele gider.</p>}
      </fieldset>

      <fieldset disabled className="opacity-60">
        <legend className="label">Ses (sesli mod geldiğinde açılacak)</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="hint mb-1 block">Konuşmayı yazıya çevirme (STT)</span>
            <select className="field" value={config.providers.stt} onChange={() => {}}>
              {providers.stt.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="hint mb-1 block">Seslendirme (TTS)</span>
            <select className="field" value={config.providers.tts} onChange={() => {}}>
              {providers.tts.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}

function AdvancedTab({ config, onChange }: { config: AgentConfig; onChange: (c: AgentConfig) => void }) {
  const generated = useMemo(() => buildPersonaPrompt(config), [config]);
  const full = useMemo(() => buildSystemPrompt(config), [config]);
  const [raw, setRaw] = useState(() => JSON.stringify(config, null, 2));
  const [rawError, setRawError] = useState<string | null>(null);
  const overriding = config.prompt_override !== undefined;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label mb-0">Sistem prompt'u</span>
          <label className="flex items-center gap-2 text-[13px] text-graphite">
            <input
              type="checkbox"
              checked={overriding}
              onChange={(e) => onChange({ ...config, prompt_override: e.target.checked ? generated : undefined })}
              className="accent-[var(--ink)]"
            />
            Elle düzenle
          </label>
        </div>
        {overriding ? (
          <textarea rows={14} className="field font-mono text-[13px]" value={config.prompt_override} onChange={(e) => onChange({ ...config, prompt_override: e.target.value })} />
        ) : (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--radius-field)] border border-rule bg-white p-3 font-mono text-[12.5px] leading-5 text-ink">{full}</pre>
        )}
        <p className="hint">En baştaki güvenlik kuralları her zaman eklenir ve düzenlenemez. Elle düzenleme yalnızca altındaki kısmı değiştirir.</p>
      </div>

      <div>
        <label className="label" htmlFor="raw">
          Ham JSON
        </label>
        <textarea
          id="raw"
          rows={14}
          className="field font-mono text-[12.5px]"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={() => setRaw(JSON.stringify(config, null, 2))}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="btn-quiet text-[14px]"
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
            JSON'u uygula
          </button>
          {rawError && <span className="text-[13px] text-fault">{rawError}</span>}
        </div>
      </div>
    </div>
  );
}
