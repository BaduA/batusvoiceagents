"use client";

import { useCallback, useEffect, useState } from "react";
import { AppMark } from "./SiteHeader";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mx-auto mt-16 max-w-[20rem] text-center"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
        if (r.ok) location.reload();
        else setError((await r.json()).error);
      }}
    >
      <div className="flex justify-center">
        <AppMark size={56} />
      </div>
      <h1 className="mt-4 text-[22px] font-bold">Yönetici girişi</h1>
      <p className="mt-1 text-[14px] text-secondary">Yönetici modunda limit yoktur ve tüm modeller açıktır.</p>
      <label htmlFor="key" className="sr-only">
        Yönetici anahtarı
      </label>
      <input id="key" type="password" placeholder="Yönetici anahtarı" className="field mt-6 text-center" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
      {error && <p className="mt-2 text-[13px] text-end">{error}</p>}
      <button className="btn-primary mt-3 w-full py-2">Giriş yap</button>
    </form>
  );
}

interface Overview {
  review: { id: string; name: string; status: string; reason: string | null; reports: number; shareSlug: string }[];
  events: { id: string; layer: number; decision: string; categories: string[]; reason: string | null; agentId: string | null; createdAt: string; ipHash: string }[];
  recent: { id: string; name: string; owner: string; status: string; share: boolean }[];
}

export function AdminDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setData);
  }, []);
  useEffect(load, [load]);

  const act = async (id: string, action: "approve" | "freeze" | "delete") => {
    await fetch(`/api/admin/agents/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-[26px] font-bold tracking-[-0.02em]">Yönetim</h1>
        <button
          className="btn-quiet"
          onClick={async () => {
            const r = await fetch("/api/admin/seed", { method: "POST" });
            const j = await r.json();
            setMsg(j.created?.length ? `Eklendi: ${j.created.join(", ")}` : "Örnek agent'lar zaten ekli.");
            load();
          }}
        >
          Örnek agent'ları ekle
        </button>
        <button
          className="btn-quiet"
          onClick={async () => {
            const r = await fetch("/api/cron/cleanup");
            const j = await r.json();
            setMsg(`Temizlendi: ${j.sessions} görüşme, ${j.safetyEvents} güvenlik kaydı`);
          }}
        >
          Eski kayıtları temizle
        </button>
        <button
          className="btn-text"
          onClick={async () => {
            await fetch("/api/admin/login", { method: "DELETE" });
            location.reload();
          }}
        >
          Çıkış
        </button>
      </div>
      {msg && <p className="rounded-[10px] bg-fill px-3.5 py-2 text-[13px]">{msg}</p>}

      <section>
        <h2 className="group-title">İnceleme bekleyenler</h2>
        <div className="group-list">
          {data?.review.length === 0 && <p className="row text-secondary">İnceleme bekleyen agent yok.</p>}
          {data?.review.map((a) => (
            <div key={a.id} className="row flex-wrap py-2.5">
              <div className="min-w-0 flex-1">
                <a href={`/agents/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </a>
                <p className="text-[12px] text-secondary">
                  {a.reason ?? "Neden yok"}
                  {a.reports ? `, ${a.reports} bildirim` : ""}
                </p>
              </div>
              <button className="btn-quiet py-1 text-[13px]" onClick={() => act(a.id, "approve")}>
                Onayla ve paylaşımı aç
              </button>
              <button className="btn-text py-1 text-[13px] text-end hover:text-end" onClick={() => act(a.id, "delete")}>
                Sil
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="group-title">Güvenlik kayıtları</h2>
        <div className="overflow-x-auto rounded-[10px] bg-surface">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[12px] text-secondary">
              <tr>
                <th className="px-4 py-2 font-medium">Zaman</th>
                <th className="px-3 py-2 font-medium">Katman</th>
                <th className="px-3 py-2 font-medium">Karar</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium">Neden</th>
                <th className="px-3 py-2 font-medium">IP (hash)</th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((e) => (
                <tr key={e.id} className="border-t border-separator align-top">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums">{new Date(e.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-2">{e.layer}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${e.decision === "block" ? "bg-end-soft text-end" : "bg-needle-soft text-needle-ink"}`}>{e.decision}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[12px]">{e.categories.join(", ")}</td>
                  <td className="max-w-[28rem] px-3 py-2 text-secondary">{e.reason}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-secondary">{e.ipHash.slice(0, 8)}</td>
                </tr>
              ))}
              {data?.events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-secondary">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="group-title">Son agent'lar</h2>
        <div className="group-list">
          {data?.recent.map((a) => (
            <div key={a.id} className="row">
              <a href={`/agents/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                {a.name}
              </a>
              <span className="text-[12px] text-secondary">
                {a.owner === "admin" ? "yönetici" : "anonim"}, {a.share ? "paylaşımda" : "paylaşım kapalı"}
              </span>
              {a.share && (
                <button className="btn-text py-1 text-[13px]" onClick={() => act(a.id, "freeze")}>
                  Dondur
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
