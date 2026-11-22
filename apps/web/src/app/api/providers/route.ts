import { providerAvailability } from "@/lib/providers";
import { isAdmin } from "@/lib/security";

export async function GET() {
  return Response.json({ ...providerAvailability(), admin: await isAdmin() });
}
