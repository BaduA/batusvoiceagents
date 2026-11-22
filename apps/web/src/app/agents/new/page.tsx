import { agentConfigSchema, getPreset } from "@vap/core";
import { Workbench } from "@/components/Workbench";

export default async function NewAgentPage({ searchParams }: PageProps<"/agents/new">) {
  const { preset } = await searchParams;
  const p = getPreset(typeof preset === "string" ? preset : "blank") ?? getPreset("blank")!;
  const config = agentConfigSchema.parse({ ...p.config, role: p.config.role || " " });
  if (!p.config.role) config.role = "";
  return <Workbench agent={null} initialConfig={config} mode="edit" />;
}
