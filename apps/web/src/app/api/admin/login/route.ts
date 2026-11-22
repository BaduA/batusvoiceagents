import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminCookie, checkAdminKey } from "@/lib/security";

export async function POST(req: Request) {
  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  if (!checkAdminKey(key ?? "")) return Response.json({ error: "Anahtar hatalı." }, { status: 401 });
  (await cookies()).set(ADMIN_COOKIE, adminCookie()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
