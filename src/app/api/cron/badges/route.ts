import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkEventBadges } from "@/lib/badges";
import { awardBadgeCountPoints } from "@/lib/points";

// Vercel Cron から毎日 AM 2:00 (JST) に呼ばれる
// Authorization: Bearer $CRON_SECRET で保護
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const nowUtc = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const nowJst = new Date(nowUtc.getTime() + jstOffset);
  const todayJst = nowJst.getUTCDate();
  const todayMonthJst = nowJst.getUTCMonth();
  const todayYearJst = nowJst.getUTCFullYear();

  // ---- 月初（1日）: 前月バッジ数ボーナス付与 ----
  if (todayJst === 1) {
    const prevMonth = todayMonthJst === 0 ? 12 : todayMonthJst;
    const prevYear = todayMonthJst === 0 ? todayYearJst - 1 : todayYearJst;
    const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const { data: badgeUsers } = await supabase
      .from("user_badges")
      .select("user_id")
      .eq("period", prevYearMonth);

    const uniqueUserIds = [...new Set((badgeUsers ?? []).map((r: { user_id: string }) => r.user_id))];

    await Promise.all(
      uniqueUserIds.map((userId) => awardBadgeCountPoints(supabase, userId, prevYearMonth))
    );
  }

  // ---- 毎日: 前日開催イベントのバッジチェック ----
  const yesterdayStart = new Date(nowUtc);
  yesterdayStart.setUTCDate(nowUtc.getUTCDate() - 1);
  yesterdayStart.setUTCHours(0, 0, 0, 0);

  const yesterdayEnd = new Date(yesterdayStart);
  yesterdayEnd.setUTCHours(23, 59, 59, 999);

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id")
    .gte("start_at", yesterdayStart.toISOString())
    .lte("start_at", yesterdayEnd.toISOString());

  if (eventsError || !events || events.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const eventIds = events.map((e: { id: string }) => e.id);

  const { data: bookings } = await supabase
    .from("bookings")
    .select("user_id")
    .in("event_id", eventIds)
    .eq("status", "confirmed");

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const userIds = [...new Set(bookings.map((b: { user_id: string }) => b.user_id))];

  await Promise.all(userIds.map((userId) => checkEventBadges(supabase, userId)));

  return NextResponse.json({ processed: userIds.length });
}
