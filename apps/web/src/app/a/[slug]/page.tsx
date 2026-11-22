import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgentBySlug, publicAgent } from "@/lib/agents";
import { canEditAgent } from "@/lib/security";
import { SiteHeader } from "@/components/SiteHeader";
import { Workbench } from "@/components/Workbench";
import { ReportButton } from "@/components/ReportButton";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getAgentBySlug(slug);
  return { title: a?.shareEnabled ? `${a.name} · Voice Agent Playground` : "Voice Agent Playground", robots: { index: false } };
}

export default async function SharedAgentPage({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();
  const editor = await canEditAgent(agent);
  if (!agent.shareEnabled && !editor) {
    return (
      <div className="flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="mx-auto max-w-lg px-6 py-20">
          <h1 className="text-[24px] font-bold">Bu link şu an kapalı</h1>
          <p className="mt-3 text-[16px] leading-7 text-graphite">Agent inceleme bekliyor veya sahibi tarafından paylaşıma kapatıldı.</p>
        </main>
      </div>
    );
  }
  const pub = publicAgent(agent, editor);
  const c = pub.config;
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader>
        {editor && (
          <a className="text-[14px] text-graphite hover:text-ink" href={`/agents/${agent.id}`}>
            Düzenle
          </a>
        )}
        <ReportButton agentId={agent.id} />
      </SiteHeader>
      <section className="border-b border-rule bg-sheet px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-1">
          <h1 className="text-[22px] font-bold leading-7">{c.name}</h1>
          <p className="max-w-[70ch] text-[15px] leading-6 text-graphite">
            {c.company.name ? `${c.company.name} için demo. ` : "Demo agent. "}
            {c.role.length > 220 ? c.role.slice(0, 220) + "…" : c.role}
          </p>
          <p className="text-[13px] text-graphite">Bu bir test ortamıdır. Gerçek kişisel bilgi, kart veya şifre paylaşmayın.</p>
        </div>
      </section>
      <Workbench agent={pub} initialConfig={c} mode="shared" />
    </div>
  );
}
