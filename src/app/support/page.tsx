import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSessionUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import SupportChat from "@/components/SupportChat";
import type { SupportMessage } from "@/lib/support";

// お問い合わせ（運営とのチャット）。マイページの「お問い合わせ」から開く
export default async function SupportPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("support_messages")
    .select("id, sender, body, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  // 開いた時点で運営からの返信を既読にする（下ナビ・マイページの未読の印が消える）
  await createServiceClient()
    .from("support_messages")
    .update({ read_by_user_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("sender", "admin")
    .is("read_by_user_at", null);

  return (
    <main className="relative min-h-screen app-bg pb-28">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/mypage" aria-label="マイページへ戻る" className="text-ink-300 hover:text-ink-600 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="font-outfit text-lg font-semibold text-ink-700">お問い合わせ</h1>
        </div>
        <p className="font-dm text-xs text-ink-300 mb-5">
          Hibi 運営にメッセージを送れます。返信が届くと、メールでお知らせします。
        </p>

        <SupportChat
          messages={(data ?? []) as SupportMessage[]}
          postUrl="/api/support/messages"
          viewer="user"
          emptyText={"ご質問・ご要望など、お気軽にお送りください。\n運営より順次ご返信します。"}
          placeholder="メッセージを入力"
        />
      </div>

      <BottomNav />
    </main>
  );
}
