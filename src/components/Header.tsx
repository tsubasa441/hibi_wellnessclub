"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// 設定（ニックネーム・パスワード・カード・ログアウト・退会）は 2026-10-16 にマイページ（/mypage）へ移設
export default function Header() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // getSession はブラウザ側で Cookie を読むだけで通信しない（getUser は毎回認証サーバーへ問い合わせる）。
      // ここでは自分の行を読む id を得るだけで、アクセス制御は RLS が担う
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      setIsAdmin(data?.is_admin === true);
    })();
  }, []);

  return (
    <header className="nm-nav-top">
      <div className="max-w-2xl mx-auto px-5 py-4 sm:px-8 flex items-center justify-between">
        <Link href="/home" className="inline-flex">
          <Image src="/images/hibi-logo.png" alt="Hibi" width={540} height={236} priority className="h-7 w-auto" />
        </Link>
        {isAdmin && (
          <Link href="/admin/events" className="font-outfit text-xs text-ink-700 hover:text-ink-800 transition">
            管理画面
          </Link>
        )}
      </div>
    </header>
  );
}
