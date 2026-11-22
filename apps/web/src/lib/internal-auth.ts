import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "./agents";

/** Worker → web calls carry `Authorization: Bearer $INTERNAL_API_SECRET`. */
export function requireInternal(req: Request) {
  const secret = process.env.INTERNAL_API_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || got.length !== secret.length || !timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    throw new ApiError(401, "Yetkisiz.");
  }
}
