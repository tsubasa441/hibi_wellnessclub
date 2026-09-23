"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SettingsDrawer from "@/components/SettingsDrawer";

export default function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("is_admin, nickname").eq("id", user.id).single();
      setIsAdmin(data?.is_admin === true);
      setNickname(data?.nickname ?? "");
    })();
  }, []);

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
          <SettingsDrawer nickname={nickname} />
        </div>
      </div>
    </header>
  );
}
