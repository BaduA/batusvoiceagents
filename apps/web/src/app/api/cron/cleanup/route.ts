import { cleanupOldData } from "@/lib/cleanup";
import { isAdmin } from "@/lib/security";

/** Call daily (Vercel Cron / Supabase pg_cron / any scheduler) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const ok = (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) || (await isAdmin());
  if (!ok) return Response.json({ error: "Yetkisiz." }, { status: 401 });
  return Response.json(await cleanupOldData());
}
