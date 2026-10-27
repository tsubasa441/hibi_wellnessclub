import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

// アカウント削除（退会）：ログイン情報（auth.users）を削除する（2026-10-27、依頼者の指定で匿名化から変更）。
// profiles は auth.users に連動して消え、ポイントの記録・バッジ・紹介・お問い合わせ・キャンセル待ち等も一緒に消える。
// 予約・支払いの記録だけは売上の記録として、user_id を null にして残す（035_retain_booking_records.sql）。
// これからの予約がある場合は、返金の有無（2日前ルール）を本人に確かめてもらうため、先にキャンセルしてもらう。
export async function POST(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`account-delete:${user.id}`, 3, 300))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin) {
    return NextResponse.json(
      { error: "管理者アカウントはこの画面から削除できません。運営にご連絡ください。" },
      { status: 400 }
    );
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, event_start_at, event_end_at")
    .eq("user_id", user.id)
    .eq("status", "confirmed");
  const now = Date.now();
  const hasUpcoming = (bookings ?? []).some((b) => {
    if (!b.event_start_at) return false;
    const end = b.event_end_at ? new Date(b.event_end_at).getTime() : new Date(b.event_start_at).getTime() + 2 * 60 * 60 * 1000;
    return end > now;
  });
  if (hasUpcoming) {
    return NextResponse.json(
      { error: "これからのイベントの予約があります。予約済みの画面で予約をキャンセルしてから、退会してください。" },
      { status: 400 }
    );
  }

  const { error } = await createServiceClient().auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "アカウントの削除に失敗しました。時間をおいて、もう一度お試しください。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
