"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "radix-ui";
import { CaretDownIcon, CheckIcon, ShareNetworkIcon, XIcon } from "@phosphor-icons/react";
import { PRESETS, type AgentConfig, type PerMinuteEstimate, type ProviderSelection } from "@vap/core";
import type { PublicAgent } from "@/lib/agents";
import type { ProviderAvailability } from "@/lib/providers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { DefinitionSection, SECTION_TITLES, sample, type Section } from "../DefinitionPanel";
import { Segmented, Select } from "../ModelPicker";
import { RecentAgents } from "../RecentAgents";
import { VoicePickerSheet } from "../VoicePickerSheet";
import { fmtUsd } from "./TalkStage";

type Tab = "models" | "agent" | "share";

const LINE_COLOR: Record<PerMinuteEstimate["lines"][number]["id"], string> = {
  stt: "var(--stt)",
  llm: "var(--llm)",
  tts: "var(--tts)",
  realtime: "var(--rt)",
  platform: "var(--muted-foreground)",
};

export function SettingsSheet({
  open,
  onOpenChange,
  mode,
  live,
  config,
  onConfig,
  combo,
  onCombo,
  estimate,
  providers,
  agent,
  dirty,
  saveLabel,
  saving,
  onSave,
  onTemplate,
  extra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "edit" | "shared";
  live: boolean;
  config: AgentConfig;
  onConfig: (c: AgentConfig) => void;
  combo: ProviderSelection;
  onCombo: (c: ProviderSelection) => void;
  estimate: PerMinuteEstimate;
  providers: ProviderAvailability | null;
  agent: PublicAgent | null;
  dirty: boolean;
  saveLabel: string;
  saving: boolean;
  onSave: () => void;
  onTemplate: (presetId: string) => void;
  extra?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("models");
  const [voiceSheet, setVoiceSheet] = useState(false);
  const tabs: [Tab, string][] = mode === "edit" ? [["models", "Modeller"], ["agent", "Agent"], ["share", "Paylaş"]] : [["models", "Modeller"]];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" style={{ animation: "fade-in 160ms ease-out" }} />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-background shadow-pop outline-none sm:w-[440px]"
          style={{ animation: "sheet-in 240ms cubic-bezier(.2,.8,.2,1)" }}
          onEscapeKeyDown={(e) => voiceSheet && e.preventDefault()}
          aria-describedby={undefined}
        >
          <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
            <Dialog.Title className="flex-1 font-mono text-xs font-bold tracking-wider uppercase">Ayarlar</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Kapat">
                <XIcon size={18} weight="bold" />
              </Button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <CostCard estimate={estimate} />

            {tabs.length > 1 && (
              <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
                <Segmented label="Ayar bölümü" value={tab} onChange={setTab} options={tabs} />
              </div>
            )}

            <div className="px-5 py-5">
              {tab === "models" &&
                (providers ? (
                  <ModelSettings
                    value={combo}
                    onChange={onCombo}
                    providers={providers}
                    onVoice={() => setVoiceSheet(true)}
                    note={live ? "Görüşme sürüyor; değişiklikler bir sonraki görüşmede geçerli olur." : mode === "shared" ? "Seçimler bu tarayıcıdaki bir sonraki görüşme için geçerli." : undefined}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Modeller yükleniyor…</p>
                ))}
              {tab === "agent" && <AgentSettings config={config} onConfig={onConfig} providers={providers} canTemplate={!agent} onTemplate={onTemplate} />}
              {tab === "share" && <ShareSettings agent={agent} dirty={dirty} />}
            </div>
          </div>

          {(mode === "edit" || extra) && (
            <footer className="flex items-center gap-3 border-t border-border px-5 py-3">
              <p className={cn("min-w-0 flex-1 truncate text-xs", dirty ? "text-warn-ink" : "text-muted-foreground")}>{mode === "edit" ? saveLabel : null}</p>
              {extra}
              {mode === "edit" && (
                <Button onClick={onSave} disabled={saving || (!dirty && !!agent)} className="rounded-full font-mono text-xs font-bold tracking-wider uppercase">
                  {saving ? "Kontrol ediliyor…" : !dirty && agent ? (
                    <>
                      <CheckIcon size={14} weight="bold" /> Kaydedildi
                    </>
                  ) : (
                    "Kaydet"
                  )}
                </Button>
              )}
            </footer>
          )}

          {voiceSheet && providers && <VoiceSheet combo={combo} onCombo={onCombo} providers={providers} config={config} onClose={() => setVoiceSheet(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The number the user asked for: what the current selection costs per minute of talk. */
function CostCard({ estimate }: { estimate: PerMinuteEstimate }) {
  const [why, setWhy] = useState(false);
  return (
    <section className="border-b border-border px-5 py-5" aria-label="Dakikalık maliyet">
      <p className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground uppercase">Dakikalık toplam</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-4xl font-bold tracking-tight">{fmtUsd(estimate.total)}</span>
        <span className="font-mono text-sm text-muted-foreground">/ dk</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">≈ {fmtUsd(estimate.total * 3)} / 3 dk demo</span>
      </p>
      {/* stacked bar: each model's share of the minute */}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        {estimate.lines.map((l) => (
          <span key={l.id} style={{ width: `${(l.usd / (estimate.total || 1)) * 100}%`, background: LINE_COLOR[l.id] }} className="h-full border-r-2 border-background last:border-r-0" />
        ))}
      </div>
      <dl className="mt-3 space-y-1.5">
        {estimate.lines.map((l) => (
          <div key={l.id} className="flex items-center gap-2 text-sm">
            <span className="size-2 shrink-0 rounded-full" style={{ background: LINE_COLOR[l.id] }} aria-hidden />
            <dt className="min-w-0 flex-1 truncate text-muted-foreground">
              <span className="mr-1.5 font-mono text-[10px] font-bold tracking-wider uppercase">{l.id === "platform" ? "Altyapı" : l.id === "realtime" ? "S2S" : l.id}</span>
              {l.label}
            </dt>
            <dd className="font-mono text-xs tabular-nums">{fmtUsd(l.usd)}</dd>
          </div>
        ))}
      </dl>
      <button className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setWhy((w) => !w)} aria-expanded={why}>
        Nasıl hesaplanıyor?
        <CaretDownIcon size={12} className={cn("transition-transform", why && "rotate-180")} />
      </button>
      {why && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Tipik bir demo dakikası: STT dakikanın tamamını dinler, agent ~340 karakter konuşur, ~4 cevap verir (her biri ~2.000 girdi, ~60 çıktı token). LiveKit altyapısı ücretsiz kotadan sonra ~$0.01/dk. Fiyatlar
          tahmini; görüşme bitince gerçek kullanımdan hesaplanan maliyet gösterilir.
        </p>
      )}
    </section>
  );
}

type Opt = { id: string; label: string; available: boolean };
const withPrice = <T extends Opt>(list: T[], price: (m: T) => string) => list.map((m) => ({ ...m, label: `${m.label} · ${price(m)}` }));

function Field({ label, hint, color, children }: { label: string; hint: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 flex items-baseline gap-2 text-sm">
        <span className="size-2 translate-y-[-1px] rounded-full" style={{ background: color }} aria-hidden />
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </p>
      {children}
    </div>
  );
}

function ModelSettings({
  value,
  onChange,
  providers,
  onVoice,
  note,
}: {
  value: ProviderSelection;
  onChange: (v: ProviderSelection) => void;
  providers: ProviderAvailability;
  onVoice: () => void;
  note?: string;
}) {
  const set = (patch: Partial<ProviderSelection>) => onChange({ ...value, ...patch });
  const tts = providers.tts.find((t) => t.id === value.tts);
  const voices = tts?.voices ?? [];
  const voice = value.voice || (voices[0]?.id ?? "");
  const voiceLabel = voices.find((v) => v.id === voice)?.label ?? value.voice_label ?? voice;

  return (
    <div className="space-y-5">
      {note && <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{note}</p>}
      <div>
        <Segmented
          label="Ses modu"
          value={value.mode}
          onChange={(m) => set({ mode: m })}
          options={[
            ["pipeline", "STT → LLM → TTS"],
            ["realtime", "Speech-to-speech"],
          ]}
        />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {value.mode === "pipeline"
            ? "Üç ayrı model: sesi yazıya çevirir, cevabı yazar, seslendirir. Her aşamanın gecikmesi ayrı ölçülür."
            : "Tek model hem dinler hem konuşur. Genelde daha hızlı, ama aşamalar ayrı ölçülemez."}
        </p>
      </div>
      {value.mode === "pipeline" ? (
        <>
          <Field label="Konuşmayı yazıya çevirme" hint="STT" color="var(--stt)">
            <Select id="set-stt" label="STT modeli" value={value.stt} options={withPrice(providers.stt, (m) => `$${m.perMinute}/dk`)} onChange={(v) => set({ stt: v })} />
          </Field>
          <Field label="Cevabı yazan model" hint="LLM" color="var(--llm)">
            <Select id="set-llm" label="Dil modeli" value={value.llm} options={withPrice(providers.llm, (m) => `$${m.inputPerM}/$${m.outputPerM} 1M token`)} onChange={(v) => set({ llm: v })} />
          </Field>
          <Field label="Seslendirme" hint="TTS" color="var(--tts)">
            <div className="space-y-2">
              <Select id="set-tts" label="TTS modeli" value={value.tts} options={withPrice(providers.tts, (m) => `$${m.per1kChars}/1K karakter`)} onChange={(v) => set({ tts: v, voice: "", voice_label: undefined })} />
              <button type="button" onClick={onVoice} aria-haspopup="dialog" className="field flex items-center gap-2 py-1.5 text-left">
                <span className="text-muted-foreground">Ses</span>
                <span className="min-w-0 flex-1 truncate font-medium">{voiceLabel}</span>
                <span className="text-xs text-primary">Değiştir</span>
              </button>
            </div>
          </Field>
        </>
      ) : (
        <Field label="Speech-to-speech model" hint="Realtime" color="var(--rt)">
          <Select id="set-rt" label="Realtime model" value={value.realtime} options={withPrice(providers.realtime, (m) => `~$${m.perMinute}/dk`)} onChange={(v) => set({ realtime: v })} />
        </Field>
      )}
      {!providers.voice && <p className="text-xs leading-5 text-destructive">Sunucuda LiveKit ayarları eksik: modeller seçilebilir ama görüşme başlatılamaz.</p>}
      <p className="text-xs leading-5 text-muted-foreground">“yapılandırılmamış” olanlar için sunucuya o sağlayıcının anahtarı eklenmeli (LiveKit Cloud'da çoğu anahtarsız çalışır).</p>
    </div>
  );
}

function VoiceSheet({ combo, onCombo, providers, config, onClose }: { combo: ProviderSelection; onCombo: (c: ProviderSelection) => void; providers: ProviderAvailability; config: AgentConfig; onClose: () => void }) {
  const tts = providers.tts.find((t) => t.id === combo.tts);
  if (!tts) return null;
  return (
    <VoicePickerSheet
      ttsId={tts.id}
      ttsLabel={tts.label}
      value={combo.voice || (tts.voices[0]?.id ?? "")}
      language={config.persona.language}
      sampleText={sample(config)}
      onClose={onClose}
      onPick={(id, label) => {
        onCombo({ ...combo, voice: id, voice_label: label });
        onClose();
      }}
    />
  );
}

const AGENT_SECTIONS: Section[] = ["task", "persona", "knowledge", "actions", "advanced"];

function AgentSettings({
  config,
  onConfig,
  providers,
  canTemplate,
  onTemplate,
}: {
  config: AgentConfig;
  onConfig: (c: AgentConfig) => void;
  providers: ProviderAvailability | null;
  canTemplate: boolean;
  onTemplate: (id: string) => void;
}) {
  const [openSection, setOpenSection] = useState<Section | null>("task");
  return (
    <div className="space-y-4">
      {canTemplate && (
        <div>
          <label htmlFor="tpl" className="mb-1.5 block text-sm font-semibold">
            Şablon
          </label>
          <Select id="tpl" label="Şablon" value="" options={[{ id: "", label: "Bir şablonla baştan başla…", available: true }, ...PRESETS.map((p) => ({ id: p.id, label: `${p.label}: ${p.summary}`, available: true }))]} onChange={(v) => v && onTemplate(v)} />
        </div>
      )}
      <div className="divide-y divide-border rounded-xl border border-border">
        {AGENT_SECTIONS.map((s) => (
          <section key={s}>
            <h3>
              <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold" aria-expanded={openSection === s} onClick={() => setOpenSection((o) => (o === s ? null : s))}>
                <span className="flex-1">{SECTION_TITLES[s]}</span>
                {s === "actions" && config.actions.length > 0 && <span className="font-mono text-xs text-muted-foreground">{config.actions.length}</span>}
                <CaretDownIcon size={14} className={cn("text-muted-foreground transition-transform", openSection === s && "rotate-180")} />
              </button>
            </h3>
            {openSection === s && (
              <div className="px-4 pb-4">
                <DefinitionSection compact section={s} config={config} onChange={onConfig} providers={providers} />
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function ShareSettings({ agent, dirty }: { agent: PublicAgent | null; dirty: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = agent ? `${typeof location === "undefined" ? "" : location.origin}/a/${agent.shareSlug}` : "";
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-1 text-sm font-semibold">Paylaşım linki</h3>
        {!agent ? (
          <p className="text-sm leading-6 text-muted-foreground">Agent'ı kaydedin (ya da bir görüşme başlatın), link oluşsun.</p>
        ) : agent.shareEnabled ? (
          <>
            <p className="mb-2 text-sm leading-6 text-muted-foreground">Linki açan herkes bu agent'la sadece konuşabilir; tanımı göremez.{dirty ? " Kaydedilmemiş değişiklikler linke yansımaz." : ""}</p>
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Paylaşım linki" className="field min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  } catch {
                    /* the field is selectable */
                  }
                }}
              >
                {copied ? <CheckIcon size={16} weight="bold" /> : <ShareNetworkIcon size={16} weight="bold" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{agent.moderationStatus === "warn" ? "Paylaşım onay bekliyor: içerik incelemeye alındı." : "Paylaşım bu agent için kapalı."}</p>
        )}
      </section>
      <RecentAgents />
      <p className="text-xs text-muted-foreground">
        <Link href="/admin" className="underline-offset-2 hover:underline">
          Yönetim paneli
        </Link>
      </p>
    </div>
  );
}
