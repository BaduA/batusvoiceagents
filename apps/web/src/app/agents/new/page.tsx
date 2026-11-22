import { agentConfigSchema, getPreset } from "@vap/core";
import { SiteHeader } from "@/components/SiteHeader";
import { Workbench } from "@/components/Workbench";

export default async function NewAgentPage({ searchParams }: PageProps<"/agents/new">) {
  const { preset } = await searchParams;
  const p = getPreset(typeof preset === "string" ? preset : "blank") ?? getPreset("blank")!;
  const config = agentConfigSchema.parse({ ...p.config, role: p.config.role || " " });
  if (!p.config.role) config.role = "";
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader>
        <span className="text-[13px] text-graphite">Şablon: {p.label}</span>
      </SiteHeader>
      <Workbench agent={null} initialConfig={config} mode="edit" />
    </div>
  );
}
