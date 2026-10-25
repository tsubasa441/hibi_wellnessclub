import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkEventBadges } from "@/lib/badges";
import { checkRankUp } from "@/lib/ranks";
import { checkAndAwardReferralReward } from "@/lib/referrals";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { CHECKIN_CLOSES_AFTER_MINUTES, CHECKIN_OPENS_BEFORE_MINUTES, getCheckinWindow } from "@/lib/checkinWindow";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`booking-checkin:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const bookingId = id;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, status, checked_in_at, events(start_at, end_at)")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }
  if (booking.user_id !== user.id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }
  if (booking.status !== "confirmed") {
    return NextResponse.json({ error: "この予約はチェックインできません" }, { status: 400 });
  }

  if (booking.checked_in_at) {
    return NextResponse.json({ success: true, already: true });
  }

  const eventRaw = booking.events;
  const event = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw) as
    | { start_at: string; end_at: string | null }
    | null;
  if (!event) {
    return NextResponse.json({ error: "イベント情報が取得できません" }, { status: 500 });
  }

  const now = new Date();
  const { opensAt, closesAt } = getCheckinWindow(event.start_at);

  if (now.getTime() < opensAt) {
    return NextResponse.json({ error: `チェックインは開始${CHECKIN_OPENS_BEFORE_MINUTES}分前から受け付けます` }, { status: 400 });
  }
  if (now.getTime() > closesAt) {
    return NextResponse.json({ error: `チェックインの受付は終了しました（開始${CHECKIN_CLOSES_AFTER_MINUTES}分後まで）` }, { status: 400 });
  }

  // service_role で条件付き更新（未チェックインの行のみ）。同時リクエストの二重処理を防ぐ。
  const service = createServiceClient();
  const { data: updated, error } = await service
    .from("bookings")
    .update({ checked_in_at: now.toISOString() })
    .eq("id", bookingId)
    .is("checked_in_at", null)
    .select("id")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "チェックインに失敗しました" }, { status: 500 });
  }

  // チェックイン時点でクラスバッジ・ランク（累計参加回数）を再判定し、紹介経由の初回参加なら
  // 紹介報酬（双方 200pt）を付与する。参加ポイントは checkAndAwardPendingPoints がホームロード時にまとめて付与する。
  await checkEventBadges(service, user.id);
  await checkRankUp(service, user.id);
  await checkAndAwardReferralReward(service, user.id);

  return NextResponse.json({ success: true });
}
