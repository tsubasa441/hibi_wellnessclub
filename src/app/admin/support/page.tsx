export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { decrypt } from "@/lib/encrypt";

type Row = { user_id: string; sender: "user" | "admin"; body: string; created_at: string; read_by_admin_at: string | null };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

// お問い合わせ一覧（ユーザーごとのスレッド。新しいやり取りが上）。/admin は layout で管理者のみに制限済み
export default async function AdminSupportPage() {
  // layout と並行して描画されるため、service_role で全件を読む前にここでも管理者を確認する
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) redirect("/home");

  const service = createServiceClient();
  const { data } = await service
    .from("support_messages")
    .select("user_id, sender, body, created_at, read_by_admin_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const threads = new Map<string, { last: Row; unread: number }>();
  for (const r of rows) {
    const t = threads.get(r.user_id) ?? { last: r, unread: 0 };
    if (r.sender === "user" && !r.read_by_admin_at) t.unread += 1;
    threads.set(r.user_id, t);
  }

  const userIds = [...threads.keys()];
  const { data: profiles } = userIds.length
    ? await service.from("profiles").select("id, nickname, name").in("id", userIds)
    : { data: [] };
  const names = new Map(
    (profiles ?? []).map((p: { id: string; nickname: string | null; name: string | null }) => [
      p.id,
      { nickname: p.nickname, name: p.name ? decrypt(p.name) : "" },
    ])
  );

  return (
    <div>
      <h1 className="font-cormorant text-2xl font-semibold text-ink-700 mb-6">お問い合わせ</h1>

      {threads.size === 0 ? (
        <div className="text-center py-20 text-ink-300">
          <p className="font-dm text-sm">お問い合わせはまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...threads.entries()].map(([userId, { last, unread }]) => {
            const n = names.get(userId);
            return (
              <Link
                key={userId}
                href={`/admin/support/${userId}`}
                className="block bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(44,53,49,0.08)] hover:shadow-[0_4px_12px_rgba(44,53,49,0.12)] transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-outfit font-semibold text-ink-700">
                      {n?.nickname || "（ニックネームなし）"}
                      {n?.name && <span className="font-dm text-xs text-ink-300 ml-2">{n.name}</span>}
                    </p>
                    <p className="font-dm text-sm text-ink-500 mt-1 truncate">
                      {last.sender === "admin" ? "運営：" : ""}
                      {last.body}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="font-dm text-xs text-ink-300">{formatDate(last.created_at)}</p>
                    {unread > 0 ? (
                      <span className="font-outfit text-xs font-medium text-white bg-red-500 rounded-full px-2.5 py-0.5">
                        未読 {unread}
                      </span>
                    ) : last.sender === "user" ? (
                      <span className="font-outfit text-xs text-ink-300">未返信</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
