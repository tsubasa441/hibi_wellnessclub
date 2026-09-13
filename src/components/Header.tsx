"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      setIsAdmin(data?.is_admin === true);
    })();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="nm-nav-top">
      <div className="max-w-2xl mx-auto px-5 py-4 sm:px-8 flex items-center justify-between">
        <Link href="/home" className="font-outfit text-2xl font-bold text-ink-700 tracking-wide">
          Hibi
        </Link>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin/events" className="font-outfit text-xs text-ink-700 hover:text-ink-800 transition">
              管理画面
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="font-outfit text-xs text-ink-700 hover:text-ink-800 transition"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
