"use client";

import { useCallback, useEffect, useState } from "react";

export function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="max-w-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
        if (r.ok) location.reload();
        else setError((await r.json()).error);
      }}
    >
      <h1 className="text-[24px] font-bold">Yönetici girişi</h1>
      <p className="mt-2 text-[15px] text-graphite">Yönetici modunda limit yoktur ve tüm modeller açıktır.</p>
      <label htmlFor="key" className="label mt-6">
        Yönetici anahtarı
      </label>
      <input id="key" type="password" className="field" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" />
      {error && <p className="mt-2 text-[14px] text-fault">{error}</p>}
      <button className="btn-primary mt-4">Giriş yap</button>
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
    <div className="space-y-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-[24px] font-bold">Yönetici paneli</h1>
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
      {msg && <p className="text-[14px] text-pass">{msg}</p>}

      <section>
        <h2 className="text-[18px] font-bold">İnceleme bekleyenler</h2>
        {data?.review.length === 0 && <p className="mt-2 text-[15px] text-graphite">İnceleme bekleyen agent yok.</p>}
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {data?.review.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <a href={`/agents/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </a>
                <p className="text-[13px] text-graphite">
                  {a.reason ?? "Neden yok"}
                  {a.reports ? `, ${a.reports} bildirim` : ""}
                </p>
              </div>
              <button className="btn-quiet py-1 text-[14px]" onClick={() => act(a.id, "approve")}>
                Onayla ve paylaşımı aç
              </button>
              <button className="btn-text py-1 text-[14px] hover:text-fault" onClick={() => act(a.id, "delete")}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[18px] font-bold">Güvenlik kayıtları</h2>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-panel)] bg-console p-1">
          <table className="w-full text-left text-[13px] text-console-text">
            <thead className="text-console-text/70">
              <tr>
                <th className="px-3 py-2 font-medium">Zaman</th>
                <th className="px-3 py-2 font-medium">Katman</th>
                <th className="px-3 py-2 font-medium">Karar</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium">Neden</th>
                <th className="px-3 py-2 font-medium">IP (hash)</th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((e) => (
                <tr key={e.id} className="border-t border-console-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{new Date(e.createdAt).toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-2">{e.layer}</td>
                  <td className={`px-3 py-2 ${e.decision === "block" ? "text-[#ff8a7d]" : "text-needle"}`}>{e.decision}</td>
                  <td className="px-3 py-2 font-mono">{e.categories.join(", ")}</td>
                  <td className="max-w-[28rem] px-3 py-2">{e.reason}</td>
                  <td className="px-3 py-2 font-mono">{e.ipHash.slice(0, 8)}</td>
                </tr>
              ))}
              {data?.events.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-console-text/70">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-[18px] font-bold">Son agent'lar</h2>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {data?.recent.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 text-[15px]">
              <a href={`/agents/${a.id}`} className="flex-1 hover:underline">
                {a.name}
              </a>
              <span className="text-[13px] text-graphite">
                {a.owner === "admin" ? "yönetici" : "anonim"}, {a.share ? "paylaşımda" : "paylaşım kapalı"}
              </span>
              {a.share && (
                <button className="btn-text py-1 text-[13px]" onClick={() => act(a.id, "freeze")}>
                  Dondur
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
