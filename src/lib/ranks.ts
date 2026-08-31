import { SupabaseClient } from "@supabase/supabase-js";

export type Rank = {
  level: number;
  nameEn: string;
  nameJa: string;
  minCount: number;       // 累計参加回数
  minReferrals: number;   // 累計インパクト数（rewarded referrals）
  eventPoints: number;    // イベント参加で得られるポイント
};

export const RANKS: Rank[] = [
  { level: 1, nameEn: "Seed",         nameJa: "種",   minCount: 0,   minReferrals: 0,  eventPoints: 30  },
  { level: 2, nameEn: "Sprout",       nameJa: "芽",   minCount: 5,   minReferrals: 0,  eventPoints: 30  },
  { level: 3, nameEn: "Sapling",      nameJa: "苗",   minCount: 15,  minReferrals: 0,  eventPoints: 30  },
  { level: 4, nameEn: "Leaf",         nameJa: "葉",   minCount: 30,  minReferrals: 3,  eventPoints: 40  },
  { level: 5, nameEn: "Bud",          nameJa: "蕾",   minCount: 50,  minReferrals: 10, eventPoints: 50  },
  { level: 6, nameEn: "Bloom",        nameJa: "花",   minCount: 75,  minReferrals: 20, eventPoints: 65  },
  { level: 7, nameEn: "Fruit",        nameJa: "実",   minCount: 105, minReferrals: 30, eventPoints: 80  },
  { level: 8, nameEn: "Ancient Tree", nameJa: "大樹", minCount: 140, minReferrals: 40, eventPoints: 100 },
];

// 参加回数 + インパクト数の両条件を満たす最高ランクを返す
function getRankLevelFromStats(count: number, referrals: number): number {
  let level = 1;
  for (const rank of RANKS) {
    if (count >= rank.minCount && referrals >= rank.minReferrals) {
      level = rank.level;
    }
  }
  return level;
}

export function getRankByLevel(level: number): Rank {
  return RANKS.find((r) => r.level === level) ?? RANKS[0];
}

export function getNextRank(level: number): Rank | null {
  return RANKS.find((r) => r.level === level + 1) ?? null;
}

// チェックイン時に呼び出す（ランクアップ判定）。累計参加回数はチェックイン済みの予約のみ数える。
export async function checkRankUp(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const [
    { count: bookingCount },
    { count: referralCount },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .not("checked_in_at", "is", null),
    supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", userId)
      .eq("status", "rewarded"),
    supabase
      .from("profiles")
      .select("rank_level")
      .eq("id", userId)
      .single(),
  ]);

  const currentLevel = profile?.rank_level ?? 1;
  const earnedLevel = getRankLevelFromStats(bookingCount ?? 0, referralCount ?? 0);
  const newLevel = Math.max(earnedLevel, currentLevel);

  await supabase
    .from("profiles")
    .update({ rank_level: newLevel, rank_inactive_penalty: false })
    .eq("id", userId);
}

