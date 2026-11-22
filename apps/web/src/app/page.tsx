import { agentConfigSchema, getPreset } from "@vap/core";
import { TalkApp } from "@/components/talk/TalkApp";

/** Home is the talk screen: a ready receptionist you can call right away; change it in Settings. */
export default function Home() {
  const p = getPreset("receptionist")!;
  return <TalkApp agent={null} initialConfig={agentConfigSchema.parse(p.config)} mode="edit" />;
}
