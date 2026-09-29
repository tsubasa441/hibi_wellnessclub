"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SettingsDrawer from "@/components/SettingsDrawer";

export default function Header() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [nickname, setNickname] = useState("");
  const [savedCard, setSavedCard] = useState<{ brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null>(null);

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
      const { data } = await supabase
        .from("profiles")
        .select("is_admin, nickname, card_brand, card_last4, card_exp_month, card_exp_year")
        .eq("id", user.id)
        .single();
      setIsAdmin(data?.is_admin === true);
      setNickname(data?.nickname ?? "");
      if (data?.card_last4) {
        setSavedCard({
          brand: data.card_brand,
          last4: data.card_last4,
          expMonth: data.card_exp_month,
          expYear: data.card_exp_year,
        });
      }
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
          <SettingsDrawer nickname={nickname} savedCard={savedCard} />
        </div>
      </div>
    </header>
  );
}
