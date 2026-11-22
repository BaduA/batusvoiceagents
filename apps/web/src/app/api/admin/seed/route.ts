import { eq } from "drizzle-orm";
import { agentConfigSchema, getPreset, runLayer1 } from "@vap/core";
import { apiErrorResponse } from "@/lib/agents";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb, schema } from "@/lib/db";
import { newId, newSlug } from "@/lib/ids";
import { hashToken, newToken } from "@/lib/security";
import demos from "../../../../../seeds/demo-agents.json";

/** Inserts the portfolio demo agents (seeds/demo-agents.json). Idempotent by name. */
export async function POST() {
  try {
    await requireAdmin();
    const db = await getDb();
    const created: string[] = [];
    for (const d of demos as (Record<string, unknown> & { preset: string; name: string })[]) {
      const [exists] = await db.select({ id: schema.agents.id }).from(schema.agents).where(eq(schema.agents.name, d.name));
      if (exists) continue;
      const { preset, ...rest } = d;
      const base = getPreset(preset)?.config ?? {};
      const config = agentConfigSchema.parse({ ...base, ...rest });
      if (runLayer1(config).decision === "block") continue;
      await db.insert(schema.agents).values({
        id: newId("ag"),
        owner: "admin",
        editTokenHash: hashToken(newToken()),
        name: config.name,
        config,
        shareSlug: newSlug(),
        shareEnabled: true,
        contentWarning: /küfür|argo/i.test(config.persona.tone + config.persona.style_notes),
        moderationStatus: "allow",
        moderationReason: "Örnek agent",
      });
      created.push(config.name);
    }
    return Response.json({ created });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
