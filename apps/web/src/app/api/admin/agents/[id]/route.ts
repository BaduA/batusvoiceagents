import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { apiErrorResponse } from "@/lib/agents";
import { requireAdmin } from "@/lib/admin-guard";
import { getDb, schema } from "@/lib/db";

/** Admin review: approve (opens sharing), freeze (closes sharing) or delete. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/admin/agents/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const { action } = (await req.json()) as { action: "approve" | "freeze" | "delete" };
    const db = await getDb();
    if (action === "delete") await db.delete(schema.agents).where(eq(schema.agents.id, id));
    else if (action === "approve")
      await db.update(schema.agents).set({ moderationStatus: "allow", shareEnabled: true, moderationReason: "Yönetici onayladı", reportCount: 0 }).where(eq(schema.agents.id, id));
    else if (action === "freeze") await db.update(schema.agents).set({ moderationStatus: "warn", shareEnabled: false }).where(eq(schema.agents.id, id));
    return Response.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
