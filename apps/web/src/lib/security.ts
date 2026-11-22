import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export const ADMIN_COOKIE = "vap_admin";

export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "dev-salt"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

function adminCookieValue() {
  const key = process.env.ADMIN_KEY;
  if (!key) return null;
  return createHmac("sha256", key).update("vap-admin-v1").digest("hex");
}

export function checkAdminKey(candidate: string) {
  const key = process.env.ADMIN_KEY;
  if (!key || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const expected = adminCookieValue();
  if (!expected) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return c === expected;
}

export function adminCookie() {
  return adminCookieValue();
}

export function newToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Edit tokens are kept per agent in an httpOnly cookie, so the creator can edit from the same browser. */
export function editCookieName(agentId: string) {
  return `vap_edit_${agentId}`;
}

export async function canEditAgent(agent: { id: string; editTokenHash: string }) {
  if (await isAdmin()) return true;
  const token = (await cookies()).get(editCookieName(agent.id))?.value;
  return Boolean(token && hashToken(token) === agent.editTokenHash);
}
