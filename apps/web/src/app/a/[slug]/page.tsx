import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentBySlug, publicAgent } from "@/lib/agents";
import { canEditAgent } from "@/lib/security";
import { AppMark } from "@/components/SiteHeader";
import { Workbench } from "@/components/Workbench";
import { ReportButton } from "@/components/ReportButton";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getAgentBySlug(slug);
  return { title: a?.shareEnabled ? `${a.name}, sesli demo` : "Voice Agent Playground", robots: { index: false } };
}

export default async function SharedAgentPage({ params }: PageProps<"/a/[slug]">) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();
  const editor = await canEditAgent(agent);
  if (!agent.shareEnabled && !editor) {
    return (
      <main className="grid min-h-dvh place-items-center bg-window px-6">
        <div className="max-w-sm text-center">
          <div className="flex justify-center">
            <AppMark size={56} />
          </div>
          <h1 className="mt-5 text-[22px] font-bold">Bu link şu an kapalı</h1>
          <p className="mt-2 text-[15px] leading-[21px] text-secondary">Agent incelemede ya da sahibi tarafından paylaşıma kapatıldı.</p>
          <Link href="/" className="btn-quiet mt-6">
            Ana sayfaya dön
          </Link>
        </div>
      </main>
    );
  }
  const pub = publicAgent(agent, editor);
  const c = pub.config;
  return (
    <Workbench
      agent={pub}
      initialConfig={c}
      mode="shared"
      subtitle={c.company.name || "Sesli demo"}
      toolbarExtra={
        <>
          {editor && (
            <Link className="btn-quiet" href={`/agents/${agent.id}`}>
              Düzenle
            </Link>
          )}
          <ReportButton agentId={agent.id} />
        </>
      }
    />
  );
}
