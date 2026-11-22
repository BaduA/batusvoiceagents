import { agentConfigSchema, getPreset } from "@vap/core";
import { TalkApp } from "@/components/talk/TalkApp";

export default async function NewAgentPage({ searchParams }: PageProps<"/agents/new">) {
  const { preset } = await searchParams;
  const p = getPreset(typeof preset === "string" ? preset : "receptionist") ?? getPreset("receptionist")!;
  const config = agentConfigSchema.parse({ ...p.config, role: p.config.role || " " });
  if (!p.config.role) config.role = "";
  return <TalkApp agent={null} initialConfig={config} mode="edit" />;
}
