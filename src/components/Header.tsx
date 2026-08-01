"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="nm-nav-top">
      <div className="max-w-2xl mx-auto px-5 py-4 sm:px-8 flex items-center justify-between">
        <Link href="/home" className="font-outfit text-xl font-medium text-ink-700 tracking-wide">
          Hibi
        </Link>
        <button
          onClick={handleLogout}
          className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
