export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { decrypt } from "@/lib/encrypt";
import SupportChat from "@/components/SupportChat";
import type { SupportMessage } from "@/lib/support";

// 1人のユーザーとのお問い合わせのやり取り。開いた時点でユーザーからのメッセージを既読にする
export default async function AdminSupportThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  // layout と並行して描画されるため、service_role での読み取り・既読化の前にここでも管理者を確認する
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) redirect("/home");

  const service = createServiceClient();

  const [{ data: profile }, { data: messages }] = await Promise.all([
    service.from("profiles").select("nickname, name").eq("id", userId).maybeSingle(),
    service
      .from("support_messages")
      .select("id, sender, body, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (!profile) notFound();

  await service
    .from("support_messages")
    .update({ read_by_admin_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("sender", "user")
    .is("read_by_admin_at", null);

  const name = profile.name ? decrypt(profile.name) : "";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/support" aria-label="お問い合わせ一覧へ戻る" className="text-ink-300 hover:text-ink-600 transition">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="font-outfit text-lg font-semibold text-ink-700">
          {profile.nickname || "（ニックネームなし）"}
          {name && <span className="font-dm text-sm font-normal text-ink-300 ml-2">{name}</span>}
        </h1>
      </div>

      <SupportChat
        messages={(messages ?? []) as SupportMessage[]}
        postUrl={`/api/admin/support/${userId}/messages`}
        viewer="admin"
        emptyText="まだメッセージはありません"
        placeholder="返信を入力（送信するとユーザーにメールで通知されます）"
      />
    </div>
  );
}
