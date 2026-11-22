"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { languageName } from "@vap/core";
import { Switch } from "./ui/Switch";

interface VoiceInfo {
  id: string;
  label: string;
  description?: string;
  languages: string[];
  gender?: string;
  previewUrl?: string;
}

const GENDER: Record<string, string> = { male: "erkek", female: "kadın", masculine: "erkek", feminine: "kadın", neutral: "nötr", gender_neutral: "nötr" };

function meta(v: VoiceInfo) {
  return [v.gender ? (GENDER[v.gender.toLowerCase()] ?? v.gender) : null, v.languages.length ? v.languages.map((l) => languageName(l)).join(", ") : null, v.description]
    .filter(Boolean)
    .join(", ");
}

/** Native-style sheet: search, "only my language", live previews, paste any voice ID. */
export function VoicePickerSheet({
  ttsId,
  ttsLabel,
  value,
  language,
  sampleText,
  onPick,
  onClose,
}: {
  ttsId: string;
  ttsLabel: string;
  value: string;
  language: string;
  sampleText: string;
  onPick: (id: string, label: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ voices: VoiceInfo[]; source: string; note?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyLang, setOnlyLang] = useState(true);
  const [customId, setCustomId] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/voices?tts=${encodeURIComponent(ttsId)}`)
      .then((r) => r.json())
      .then((j) => alive && (j.error ? setError(j.error) : setData(j)))
      .catch(() => alive && setError("Ses listesi alınamadı."));
    return () => {
      alive = false;
      audio.current?.pause();
    };
  }, [ttsId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasLangInfo = data?.voices.some((v) => v.languages.length > 0) ?? false;
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    return (data?.voices ?? []).filter((v) => {
      if (needle && !`${v.label} ${v.description ?? ""} ${v.gender ?? ""}`.toLocaleLowerCase("tr").includes(needle)) return false;
      if (onlyLang && hasLangInfo && v.languages.length > 0 && !v.languages.includes(language)) return false;
      return true;
    });
  }, [data, q, onlyLang, hasLangInfo, language]);

  async function play(v: VoiceInfo) {
    audio.current?.pause();
    if (playing === v.id) {
      setPlaying(null);
      return;
    }
    setError(null);
    let src = v.previewUrl;
    if (!src) {
      setLoadingId(v.id);
      const r = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tts: ttsId, voice: v.id, text: sampleText, language }),
      });
      setLoadingId(null);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "Örnek çalınamadı.");
        return;
      }
      src = URL.createObjectURL(await r.blob());
    }
    const a = new Audio(src);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.onerror = () => {
      setPlaying(null);
      setError("Örnek çalınamadı.");
    };
    setPlaying(v.id);
    void a.play();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85dvh] w-full max-w-[30rem] flex-col overflow-hidden rounded-t-[16px] bg-window shadow-window sm:rounded-[14px]"
        style={{ animation: "rise 200ms ease-out" }}
      >
        <header className="flex items-center gap-3 border-b border-separator bg-surface px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="voice-title" className="text-[16px] font-semibold">
              Ses seç
            </h2>
            <p className="truncate text-[12px] text-secondary">
              {ttsLabel}
              {data ? `, ${data.voices.length} ses` : ""}
            </p>
          </div>
          <button className="btn-quiet" onClick={onClose}>
            Bitti
          </button>
        </header>

        <div className="space-y-2 border-b border-separator bg-surface px-4 pb-3 pt-2">
          <input className="field text-[14px]" placeholder="Ara: isim, aksan, cinsiyet…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Seslerde ara" autoFocus />
          {hasLangInfo && (
            <label className="flex items-center justify-between text-[13px]">
              <span>Sadece {languageName(language)} sesler</span>
              <Switch label={`Sadece ${languageName(language)} sesler`} checked={onlyLang} onChange={setOnlyLang} />
            </label>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {error && <p className="mb-2 rounded-[10px] bg-end-soft px-3 py-2 text-left text-[13px] text-end">{error}</p>}
          {!data && !error && <p className="px-2 py-6 text-center text-[14px] text-secondary">Sesler yükleniyor…</p>}
          {data && list.length === 0 && <p className="px-2 py-6 text-center text-[14px] text-secondary">Eşleşen ses yok.</p>}
          {list.length > 0 && (
            <ul className="group-list">
              {list.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => play(v)}
                    aria-label={playing === v.id ? `${v.label} durdur` : `${v.label} dinle`}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-fill text-label hover:bg-fill-strong"
                  >
                    {loadingId === v.id ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-tertiary border-t-label" />
                    ) : playing === v.id ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor" />
                        <rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.7-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onPick(v.id, v.label)}>
                    <span className="block truncate text-[15px]">{v.label}</span>
                    {meta(v) && <span className="block truncate text-[12px] text-secondary">{meta(v)}</span>}
                  </button>
                  {value === v.id && (
                    <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 text-needle-ink" aria-label="Seçili">
                      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              ))}
            </ul>
          )}
          {data?.note && <p className="group-foot">{data.note}</p>}
        </div>

        <form
          className="flex items-center gap-2 border-t border-separator bg-surface px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const id = customId.trim();
            if (id) onPick(id, `Özel ses (${id.slice(0, 8)}…)`);
          }}
        >
          <label htmlFor="custom-voice" className="sr-only">
            Ses kimliği
          </label>
          <input id="custom-voice" className="field flex-1 font-mono text-[12.5px]" placeholder="Ses kimliği yapıştır" value={customId} onChange={(e) => setCustomId(e.target.value)} />
          <button className="btn-quiet" disabled={!customId.trim()}>
            Kullan
          </button>
        </form>
      </div>
    </div>
  );
}
