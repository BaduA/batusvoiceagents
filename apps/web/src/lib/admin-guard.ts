import "server-only";
import { isAdmin } from "./security";
import { ApiError } from "./agents";

export async function requireAdmin() {
  if (!(await isAdmin())) throw new ApiError(401, "Yönetici girişi gerekli.");
}
