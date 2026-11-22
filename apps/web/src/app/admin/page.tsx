import { isAdmin } from "@/lib/security";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminLogin, AdminDashboard } from "@/components/Admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();
  return (
    <div className="min-h-dvh bg-window">
      <SiteHeader title="Yönetim" />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">{admin ? <AdminDashboard /> : <AdminLogin />}</main>
    </div>
  );
}
