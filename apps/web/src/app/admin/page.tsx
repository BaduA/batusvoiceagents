import { isAdmin } from "@/lib/security";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminLogin, AdminDashboard } from "@/components/Admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 py-10">{admin ? <AdminDashboard /> : <AdminLogin />}</main>
    </div>
  );
}
