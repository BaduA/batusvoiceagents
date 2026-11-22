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

export default async function Home() {
  const demos = await demoAgents();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-12">
        <h1 className="max-w-[22ch] text-[40px] font-bold leading-[1.1] tracking-[-0.02em] sm:text-[52px]">Herhangi bir şirketin agent'ını kur, konuş, ölç.</h1>
        <p className="mt-4 max-w-[60ch] text-[18px] leading-7 text-graphite">
          Görevi ve kişiliği tanımla, ses modellerini seç, mikrofona konuşarak test et. Her cevabın kaç milisaniyede geldiğini, neye mal olduğunu ve agent'ın hangi işlemi tetiklediğini gör. Sonra linki gönder.
        </p>

        <section className="mt-12" aria-labelledby="templates">
          <h2 id="templates" className="text-[20px] font-bold">
            Bir şablonla başla
          </h2>
          <p className="mt-1 text-[15px] text-graphite">Şablonlar yalnızca görev ve işlem tanımlarını doldurur; şirket bilgisi sizden.</p>
          <ul className="mt-5 divide-y divide-rule border-y border-rule">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <Link href={`/agents/new?preset=${p.id}`} className="group grid grid-cols-1 gap-2 py-4 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                  <span className="text-[17px] font-bold group-hover:underline group-hover:decoration-needle group-hover:decoration-2 group-hover:underline-offset-4">{p.label}</span>
                  <span>
                    <span className="block text-[15px] leading-6 text-graphite">{p.summary}</span>
                    {(p.config.actions ?? []).length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {(p.config.actions ?? []).map((a) => (
                          <code key={a.name} className="rounded-full bg-sheet px-2 py-0.5 font-mono text-[12px] text-ink ring-1 ring-rule">
                            {a.name}
                          </code>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="btn-quiet hidden text-[14px] sm:inline-flex">Kur</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
          <section aria-labelledby="demos">
            <h2 id="demos" className="text-[20px] font-bold">
              Hazır örnekler
            </h2>
            {demos.length === 0 ? (
              <p className="mt-3 text-[15px] leading-6 text-graphite">Henüz örnek yok. Yönetici panelinden örnek agent'lar eklenebilir.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {demos.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/a/${d.slug}`} className="group block">
                      <span className="text-[16px] font-medium group-hover:underline">{d.name}</span>
                      <span className="block text-[14px] leading-5 text-graphite">
                        {d.config.company.name || "Karakter"}
                        {d.contentWarning ? ", argo içerebilir" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <RecentAgents />
        </div>
      </main>
    </div>
  );
}
