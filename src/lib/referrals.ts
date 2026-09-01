import { SupabaseClient } from "@supabase/supabase-js";
import { awardPoints } from "@/lib/points";
import { checkReferralBadges } from "@/lib/badges";

// 被紹介者のホーム画面ロード時に service_role で呼ぶ（遅延評価）。
// 被紹介者が初回イベントにチェックインし、そのイベントが終了済みなら
// 紹介者・被紹介者の双方に 200pt を付与し referrals を rewarded にする。
// points_log の INSERT RLS は「本人のみ」のため、紹介者への付与には service_role が必須。
export async function checkAndAwardReferralReward(
  service: SupabaseClient,
  refereeUserId: string
): Promise<void> {
  // 1. 被紹介者としての未確定 referral を取得
  const { data: referral } = await service
    .from("referrals")
    .select("id, referrer_id, status")
    .eq("referee_id", refereeUserId)
    .maybeSingle();
  if (!referral || referral.status === "rewarded") return;

  // 2. チェックイン済み かつ 終了済みのイベントに参加しているか
  const { data: bookings } = await service
    .from("bookings")
    .select("checked_in_at, events(start_at, end_at)")
    .eq("user_id", refereeUserId)
    .eq("status", "confirmed")
    .not("checked_in_at", "is", null);

  const now = new Date();
  const attendedEndedEvent = (bookings ?? []).some((b) => {
    const ev = Array.isArray(b.events) ? b.events[0] : b.events;
    if (!ev) return false;
    const e = ev as { start_at: string; end_at: string | null };
    const end = e.end_at
      ? new Date(e.end_at)
      : new Date(new Date(e.start_at).getTime() + 2 * 60 * 60 * 1000);
    return end <= now;
  });
  if (!attendedEndedEvent) return;

  // 3. 双方に 200pt（awardPoints は points_log unique 制約で冪等）
  await awardPoints(service, referral.referrer_id, 200, "referral_reward", referral.id);
  await awardPoints(service, refereeUserId, 200, "referral_joined", referral.id);

  // 4. referrals を rewarded に更新
  await service
    .from("referrals")
    .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
    .eq("id", referral.id);

  // 5. 紹介者の月間紹介バッジ（Bridge Builder 等）を再判定
  await checkReferralBadges(service, referral.referrer_id);
}
