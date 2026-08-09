import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = await isAdmin(supabase, user.id);
  if (!admin) redirect("/home");

  return (
    <main className="relative min-h-screen app-bg pb-16">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </main>
  );
}
