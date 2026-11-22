import { desc, inArray, ne } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/agents";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb, schema } from "@/lib/db";

export async function GET() {
  try {
    await requireAdmin();
    const db = await getDb();
    const review = await db
      .select({
        id: schema.agents.id,
        name: schema.agents.name,
        status: schema.agents.moderationStatus,
        reason: schema.agents.moderationReason,
        reports: schema.agents.reportCount,
        shareSlug: schema.agents.shareSlug,
        updatedAt: schema.agents.updatedAt,
      })
      .from(schema.agents)
      .where(inArray(schema.agents.moderationStatus, ["warn", "pending"]))
      .orderBy(desc(schema.agents.updatedAt));
    const events = await db.select().from(schema.safetyEvents).orderBy(desc(schema.safetyEvents.createdAt)).limit(100);
    const recent = await db
      .select({ id: schema.agents.id, name: schema.agents.name, owner: schema.agents.owner, status: schema.agents.moderationStatus, share: schema.agents.shareEnabled })
      .from(schema.agents)
      .where(ne(schema.agents.moderationStatus, "warn"))
      .orderBy(desc(schema.agents.createdAt))
      .limit(30);
    return Response.json({ review, events, recent });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
