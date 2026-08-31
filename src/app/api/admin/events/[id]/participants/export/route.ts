import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { decrypt } from "@/lib/encrypt";
import { toCsv } from "@/lib/csv";

const PAYMENT_LABELS: Record<string, string> = { square: "Square", paypay: "PayPay", free: "無料" };
const STATUS_LABELS: Record<string, string> = { pending: "未払い", paid: "支払済み", refunded: "返金済み" };

type OptionSelection = { option_id: string; label: string; values: string[] };

type BookingRow = {
  id: string;
  user_id: string;
  payment_method: string | null;
  payment_status: string;
  points_used: number | null;
  amount_charged: number | null;
  option_selections: OptionSelection[] | null;
  checked_in_at: string | null;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const [{ data: bookings, error }, { data: eventOptions }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, user_id, payment_method, payment_status, points_used, amount_charged, option_selections, checked_in_at, created_at, profiles(name)")
      .eq("event_id", params.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true }),
    supabase
      .from("event_options")
      .select("label, sort_order")
      .eq("event_id", params.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }

  const rows = (bookings ?? []) as unknown as BookingRow[];
  // 選択項目のラベルを CSV の動的列にする。現在の event_options に加え、
  // 予約回答のスナップショットにしか残っていないラベル（改名・削除済み）も列に含める。
  const optionLabels = Array.from(
    new Set([
      ...((eventOptions ?? []) as { label: string }[]).map((o) => o.label),
      ...rows.flatMap((b) => (b.option_selections ?? []).map((s) => s.label)),
    ])
  );

  // メールアドレスは auth.users にのみ存在するため service role で取得する
  const svc = createServiceClient();
  const emails = await Promise.all(
    rows.map(async (b) => {
      const { data } = await svc.auth.admin.getUserById(b.user_id);
      return data.user?.email ?? "";
    })
  );

  const csvRows = rows.map((b, i) => {
    const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
    const selectionByLabel = new Map(
      (b.option_selections ?? []).map((s) => [s.label, s.values.join("、")])
    );
    const optionColumns: Record<string, string> = {};
    for (const label of optionLabels) {
      optionColumns[label] = selectionByLabel.get(label) ?? "";
    }
    return {
      予約ID: b.id,
      氏名: profile?.name ? decrypt(profile.name) : "",
      メールアドレス: emails[i],
      予約日時: b.created_at,
      決済方法: PAYMENT_LABELS[b.payment_method ?? ""] ?? b.payment_method ?? "",
      決済ステータス: STATUS_LABELS[b.payment_status] ?? b.payment_status,
      使用ポイント: b.points_used ?? 0,
      請求金額: b.amount_charged ?? 0,
      チェックイン: b.checked_in_at ? "済" : "未",
      チェックイン時刻: b.checked_in_at ?? "",
      ...optionColumns,
    };
  });

  const csv = toCsv(csvRows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants-${params.id}.csv"`,
    },
  });
}
