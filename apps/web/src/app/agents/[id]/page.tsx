import { notFound, redirect } from "next/navigation";
import { getAgentById, publicAgent } from "@/lib/agents";
import { canEditAgent } from "@/lib/security";
import { TalkApp } from "@/components/talk/TalkApp";

export default async function AgentPage({ params }: PageProps<"/agents/[id]">) {
  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) notFound();
  if (!(await canEditAgent(agent))) {
    if (agent.shareEnabled) redirect(`/a/${agent.shareSlug}`);
    notFound();
  }
  const pub = publicAgent(agent, true);
  return <TalkApp agent={pub} initialConfig={pub.config} mode="edit" />;
}
