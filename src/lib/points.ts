import { SupabaseClient } from "@supabase/supabase-js";
import { getRankByLevel } from "@/lib/ranks";
import { getYearMonthJst, getJstMonthBounds } from "@/lib/date";

type AwardResult = { awarded: boolean; points?: number };

export async function awardPoints(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  reason: string,
  referenceId: string
): Promise<AwardResult> {
  const { error } = await supabase.from("points_log").insert({
    user_id: userId,
    reason,
    reference_id: referenceId,
    points,
    expires_at: null,
  });

  // unique制約違反 = 既に付与済み
  if (error) return { awarded: false };

  await supabase.rpc("increment_points", { uid: userId, amount: points });

  return { awarded: true, points };
}

// ジャーナル記録時（1日1回 3pt）
export async function awardJournalPoints(
  supabase: SupabaseClient,
  userId: string,
  date: string // "YYYY-MM-DD"
): Promise<AwardResult> {
  return awardPoints(supabase, userId, 3, "journal", date);
}


// ホーム画面ロード時（イベント参加・月間ボーナスの未付与分を一括チェック）
export async function checkAndAwardPendingPoints(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const now = new Date();

  // ユーザーの現在ランクを取得してイベント参加ポイントを決定
  const { data: profile } = await supabase
    .from("profiles")
    .select("rank_level")
    .eq("id", userId)
    .single();
  const rank = getRankByLevel(profile?.rank_level ?? 1);
  const eventPts = rank.eventPoints;

  // イベント終了時刻（start_at + 2時間）を過ぎた confirmed 予約にランク応じたポイントを付与
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, event_id, events(start_at)")
    .eq("user_id", userId)
    .eq("status", "confirmed");

  const pastBookings = (bookings ?? []).filter((b) => {
    const ev = Array.isArray(b.events) ? b.events[0] : b.events;
    if (!ev) return false;
    const endAt = new Date((ev as { start_at: string }).start_at);
    endAt.setHours(endAt.getHours() + 2);
    return endAt <= now;
  });

  for (const booking of pastBookings) {
    await awardPoints(supabase, userId, eventPts, "event_participation", booking.id);
  }

  // 月間全イベント参加ボーナス（500pt）
  if (pastBookings.length === 0) return;

  const months = new Set<string>();
  for (const booking of pastBookings) {
    const ev = Array.isArray(booking.events) ? booking.events[0] : booking.events;
    if (!ev) continue;
    const startAt = new Date((ev as { start_at: string }).start_at);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 2);
    const eventYearMonth = getYearMonthJst(startAt);
    const monthEndAt = new Date(getJstMonthBounds(eventYearMonth).end);
    if (monthEndAt < now && endAt <= now) {
      months.add(eventYearMonth);
    }
  }

  for (const yearMonth of months) {
    const { start: monthStart, end: monthEnd } = getJstMonthBounds(yearMonth);

    const { data: monthEvents } = await supabase
      .from("events")
      .select("id")
      .eq("status", "published")
      .gte("start_at", monthStart)
      .lte("start_at", monthEnd);

    if (!monthEvents || monthEvents.length === 0) continue;

    const { data: monthBookings } = await supabase
      .from("bookings")
      .select("event_id")
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .in("event_id", monthEvents.map((e) => e.id));

    const bookedEventIds = new Set((monthBookings ?? []).map((b) => b.event_id));
    const allParticipated = monthEvents.every((e) => bookedEventIds.has(e.id));

    if (allParticipated) {
      await awardPoints(supabase, userId, 500, "monthly_bonus", yearMonth);
    }
  }
}

// 予約時: 保有ポイントを参加費の割引に充当する（1pt = 1円）。残高不足の場合は false を返す
export async function spendPointsForBooking(
  supabase: SupabaseClient,
  userId: string,
  points: number,
  bookingId: string
): Promise<boolean> {
  if (points <= 0) return true;

  const { data: ok } = await supabase.rpc("spend_points", { uid: userId, amount: points });
  if (!ok) return false;

  const { error } = await supabase.from("points_log").insert({
    user_id: userId,
    reason: "booking_discount",
    reference_id: bookingId,
    points: -points,
    expires_at: null,
  });

  if (error) {
    // ログ記録に失敗した場合は充当自体を取り消す
    await supabase.rpc("increment_points", { uid: userId, amount: points });
    return false;
  }

  return true;
}

// 予約キャンセル・作成失敗時: 充当したポイントを払い戻す
export async function refundUsedPoints(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string
): Promise<void> {
  const { data: log } = await supabase
    .from("points_log")
    .select("id, points")
    .eq("user_id", userId)
    .eq("reason", "booking_discount")
    .eq("reference_id", bookingId)
    .single();

  if (!log) return;

  await supabase.from("points_log").delete().eq("id", log.id);
  await supabase.rpc("increment_points", { uid: userId, amount: Math.abs(log.points) });
}

// キャンセル時: イベント参加ポイントを取り消す
export async function revokeEventPoints(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string
): Promise<void> {
  const { data: log } = await supabase
    .from("points_log")
    .select("id, points")
    .eq("user_id", userId)
    .eq("reason", "event_participation")
    .eq("reference_id", bookingId)
    .single();

  if (!log) return;

  await supabase.from("points_log").delete().eq("id", log.id);
  await supabase.rpc("decrement_points", { uid: userId, amount: log.points });
}

// 月末 cron から呼び出す（バッジ獲得数に応じたボーナスポイント）
// 3個: 300pt / 5個: 500pt / 9個: 1000pt（最高ティアのみ付与）
export async function awardBadgeCountPoints(
  supabase: SupabaseClient,
  userId: string,
  yearMonth: string // "YYYY-MM"
): Promise<void> {
  const { count } = await supabase
    .from("user_badges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("period", yearMonth);

  const badgeCount = count ?? 0;

  let pts = 0;
  if (badgeCount >= 9) pts = 1000;
  else if (badgeCount >= 5) pts = 500;
  else if (badgeCount >= 3) pts = 300;

  if (pts === 0) return;

  await awardPoints(supabase, userId, pts, "badge_count_bonus", `${yearMonth}`);
}
