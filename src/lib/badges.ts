import { SupabaseClient } from "@supabase/supabase-js";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1).toISOString();
  const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

async function award(
  supabase: SupabaseClient,
  userId: string,
  conditionType: string,
  conditionValue: number,
  period: string
): Promise<void> {
  const { data: badge } = await supabase
    .from("badges")
    .select("id")
    .eq("condition_type", conditionType)
    .eq("condition_value", conditionValue)
    .single();

  if (!badge) return;

  // unique 制約違反（既付与）は無視
  await supabase.from("user_badges").insert({ user_id: userId, badge_id: badge.id, period });
}

// イベント予約確定後・cronから呼ぶ
export async function checkEventBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const ym = currentYearMonth();
  const { start, end } = monthBounds(ym);

  // 今月確定した予約とそのイベント種別を取得
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, events(event_type)")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .gte("created_at", start)
    .lte("created_at", end);

  type BookingWithEvent = { events: { event_type: string } | { event_type: string }[] | null };
  const eventTypes = (bookings ?? [])
    .map((b) => {
      const ev = (b as unknown as BookingWithEvent).events;
      if (!ev) return undefined;
      return Array.isArray(ev) ? ev[0]?.event_type : ev.event_type;
    })
    .filter((t): t is string => Boolean(t));

  const count = eventTypes.length;

  // クラス種別初参加バッジ
  const typeMap: Record<string, string> = {
    running:  "monthly_first_running",
    yoga:     "monthly_first_yoga",
    training: "monthly_first_training",
    boxing:   "monthly_first_boxing",
  };

  for (const [type, conditionType] of Object.entries(typeMap)) {
    if (eventTypes.includes(type)) {
      await award(supabase, userId, conditionType, 1, ym);
    }
  }

  // 参加回数バッジ
  if (count >= 3) await award(supabase, userId, "monthly_event_count", 3, ym);
  if (count >= 5) await award(supabase, userId, "monthly_event_count", 5, ym);
}

// 紹介報酬付与後に呼ぶ
export async function checkReferralBadges(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const ym = currentYearMonth();
  const { start, end } = monthBounds(ym);

  const { count } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", userId)
    .eq("status", "rewarded")
    .gte("rewarded_at", start)
    .lte("rewarded_at", end);

  const referralCount = count ?? 0;

  if (referralCount >= 1) await award(supabase, userId, "monthly_referral_count", 1, ym);
  if (referralCount >= 3) await award(supabase, userId, "monthly_referral_count", 3, ym);
  if (referralCount >= 5) await award(supabase, userId, "monthly_referral_count", 5, ym);
}
