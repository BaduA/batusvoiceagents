import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { PRESETS } from "@vap/core";
import { getDb, schema } from "@/lib/db";
import { AppMark } from "@/components/SiteHeader";
import { RecentAgents } from "@/components/RecentAgents";
import { IconChevron } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const TINTS: Record<string, string> = {
  receptionist: "#5b7cfa",
  support: "#2fa86a",
  appointment: "#e5609a",
  sales: "#e8a419",
  blank: "#8e8e93",
};

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
    <main className="grid min-h-dvh place-items-center bg-window p-0 md:p-8">
      <div className="grid w-full max-w-[920px] overflow-hidden bg-surface md:min-h-[600px] md:grid-cols-[minmax(0,1fr)_300px] md:rounded-[14px] md:shadow-window" style={{ animation: "rise 300ms ease-out" }}>
        <section className="flex flex-col px-6 pb-8 pt-10 sm:px-10">
          <AppMark size={72} />
          <h1 className="mt-5 text-[30px] font-bold leading-[36px] tracking-[-0.025em]">Voice Agent Playground</h1>
          <p className="mt-2 max-w-[34rem] text-[15px] leading-[22px] text-secondary">
            Herhangi bir şirketin sesli agent'ını kur, ara, kaç milisaniyede cevap verdiğini ve neye mal olduğunu gör. Sonra linkini gönder.
          </p>

          <h2 className="mb-1.5 mt-9 px-1 text-[13px] font-medium text-secondary">Yeni agent</h2>
          <ul className="-mx-2">
            {PRESETS.map((p) => (
              <li key={p.id}>
                <Link href={`/agents/new?preset=${p.id}`} className="group flex items-center gap-3.5 rounded-[10px] px-3 py-2.5 hover:bg-fill">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[9px] text-[15px] font-semibold text-white" style={{ background: TINTS[p.id] ?? "#8e8e93" }} aria-hidden>
                    {p.label.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{p.label}</span>
                    <span className="block truncate text-[13px] text-secondary">{p.summary}</span>
                  </span>
                  <IconChevron size={15} className="shrink-0 text-tertiary group-hover:text-secondary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <aside className="border-t border-separator bg-surface-2 px-3 py-6 md:border-l md:border-t-0">
          <RecentAgents />
          <h2 className="mb-1 mt-7 px-3 text-[12px] font-semibold text-tertiary">Hazır örnekler</h2>
          {demos.length === 0 ? (
            <p className="px-3 text-[13px] leading-[18px] text-secondary">Yönetici panelinden örnek agent'lar eklenebilir.</p>
          ) : (
            <ul>
              {demos.map((d) => (
                <li key={d.slug}>
                  <Link href={`/a/${d.slug}`} className="block rounded-[8px] px-3 py-2 hover:bg-fill">
                    <span className="block truncate text-[14px] font-medium">{d.name}</span>
                    <span className="block truncate text-[12px] text-secondary">
                      {d.config.company.name || "Karakter"}
                      {d.contentWarning ? ", argo içerebilir" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </main>
  );
}
