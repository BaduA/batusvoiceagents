import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { PRESETS } from "@vap/core";
import { getDb, schema } from "@/lib/db";
import { SiteHeader } from "@/components/SiteHeader";
import { RecentAgents } from "@/components/RecentAgents";

export const dynamic = "force-dynamic";

async function demoAgents() {
  const db = await getDb();
  return db
    .select({ name: schema.agents.name, slug: schema.agents.shareSlug, config: schema.agents.config, contentWarning: schema.agents.contentWarning })
    .from(schema.agents)
    .where(and(eq(schema.agents.owner, "admin"), eq(schema.agents.shareEnabled, true)))
    .orderBy(desc(schema.agents.createdAt))
    .limit(6);
}

export default async function Welcome() {
  const demos = await demoAgents();
  return (
    <div className="min-h-dvh bg-body">
      <SiteHeader>
        <Link href="/admin" className="btn-text lowercase">
          yönetim
        </Link>
      </SiteHeader>
      <main className="mx-auto grid w-full max-w-6xl gap-6 px-3 pb-12 sm:px-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="bezel" style={{ animation: "boot 500ms ease-out" }}>
            <div className="lcd px-6 pb-8 pt-6 sm:px-9 sm:pb-10 sm:pt-7">
              <p className="lcd-num text-[16px]">
                hazır<span style={{ animation: "blink 1s steps(1) infinite" }}>_</span>
              </p>
              <h1 className="stamp mt-6 max-w-[16ch] text-[40px] leading-[1.02] sm:text-[56px]">Sesli agent'ını kur, ara, ölç.</h1>
              <p className="mt-5 max-w-[46ch] text-[16px] leading-[23px] text-lcd-ink/75">
                Herhangi bir şirketin görevini tanımla, ses modellerini seç ve mikrofona konuş. Her cevabın kaç milisaniyede geldiğini ve neye mal olduğunu bu ekrandan oku, sonra linki müşteriye gönder.
              </p>
            </div>
          </div>

          <h2 className="group-title mt-9">bir şablonla başla</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <Link href={`/agents/new?preset=${p.id}`} className="key h-full w-full flex-col items-start justify-start gap-0 px-4 pb-4 pt-3.5 text-left font-normal">
                  <span className="flex w-full items-center justify-between">
                    <span className="stamp text-[17px]">{p.label}</span>
                    <span className={`size-2 rounded-full ${p.id === "blank" ? "bg-dim" : "bg-signal"}`} aria-hidden />
                  </span>
                  <span className="mt-1 text-[13px] leading-[18px] text-faint">{p.summary}</span>
                  {(p.config.actions ?? []).length > 0 && (
                    <span className="mt-3 flex flex-wrap gap-1">
                      {(p.config.actions ?? []).map((a) => (
                        <span key={a.name} className="well rounded-[4px] px-1.5 py-0.5 font-mono text-[11px] text-faint">
                          {a.name}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="plate h-fit space-y-7 p-4">
          <RecentAgents />
          <section>
            <h2 className="group-title">hazır örnekler</h2>
            {demos.length === 0 ? (
              <p className="px-1 text-[13px] leading-[18px] text-faint">Yönetim panelinden örnek agent'lar eklenebilir.</p>
            ) : (
              <ul className="space-y-1">
                {demos.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/a/${d.slug}`} className="block rounded-[6px] px-2 py-2 hover:bg-well">
                      <span className="block truncate text-[14px] font-semibold">{d.name}</span>
                      <span className="block truncate text-[12px] text-faint">
                        {d.config.company.name || "karakter"}
                        {d.contentWarning ? ", argo içerebilir" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
