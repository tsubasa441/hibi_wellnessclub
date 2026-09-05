import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkEventBadges } from "@/lib/badges";
import { checkRankUp } from "@/lib/ranks";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

// イベント終了時刻。end_at 未設定時は開始 + 2時間（既存コードの慣習に合わせる）。
function eventEnd(startAt: string, endAt: string | null): Date {
  if (endAt) return new Date(endAt);
  const end = new Date(startAt);
  end.setHours(end.getHours() + 2);
  return end;
}

export async function POST(
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

  if (!(await checkRateLimit(`booking-checkin:${user.id}`, 20, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const bookingId = params.id;

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
  const start = new Date(event.start_at);
  const end = eventEnd(event.start_at, event.end_at);

  if (now < start) {
    return NextResponse.json({ error: "イベント開始前です" }, { status: 400 });
  }
  if (now > end) {
    return NextResponse.json({ error: "イベントは終了しました" }, { status: 400 });
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

  // チェックイン時点でクラスバッジ・ランク（累計参加回数）を再判定する。
  // 参加ポイントは checkAndAwardPendingPoints がホームロード時にまとめて付与する。
  await checkEventBadges(service, user.id);
  await checkRankUp(service, user.id);

  return NextResponse.json({ success: true });
}
