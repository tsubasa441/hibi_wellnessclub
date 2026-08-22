import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encrypt";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import ReferralShare from "@/app/impact/ReferralShare";
import { getRankByLevel, getNextRank, RANKS } from "@/lib/ranks";
import RankIcon from "@/components/RankIcon";

// ---- バッジ型定義 ----
type BadgeRow = {
  id: string;
  name: string;
  description: string;
  condition_type: string;
  condition_value: number;
};

type UserBadgeRow = {
  badge_id: string;
  period: string;
  badges: BadgeRow | BadgeRow[];
};

// ---- メーター行コンポーネント（Server Component） ----
function MeterRow({
  label,
  current,
  max,
  badgeInitial,
  earned,
  sublabel,
}: {
  label: string;
  current: number;
  max: number;
  badgeInitial: string;
  earned: boolean;
  sublabel: string;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 flex-shrink-0">
        <p className="font-outfit text-xs font-medium text-ink-700 leading-tight">{label}</p>
        <p className="font-dm text-xs text-ink-300 mt-0.5">{sublabel}</p>
      </div>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{boxShadow:"inset 2px 2px 5px #BCC0BE,inset -2px -2px 5px #FBFBFB",background:"var(--nm-bg)"}}>
        <div
          className="h-full rounded-full bg-sage-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-outfit font-bold text-xs transition ${
          earned
            ? "bg-sage-600 text-white shadow-sm"
            : "bg-base-200 text-ink-300"
        }`}
      >
        {badgeInitial}
      </div>
    </div>
  );
}

export default async function ImpactPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

  const [
    { data: profile },
    { data: bookings },
    { data: userBadges },
    { data: allBadges },
    { data: referrals },
    { data: referredNames },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("bookings")
      .select("*, events(event_type, start_at, title)")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_badges")
      .select("badge_id, period, badges(*)")
      .eq("user_id", user.id),
    supabase.from("badges").select("*"),
    supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_my_referred_names"),
  ]);

  const referredNameMap = new Map<string, string>(
    (referredNames ?? []).map((r: { referee_id: string; name: string }) => [r.referee_id, r.name])
  );

  const totalCount = (bookings ?? []).length;

  // ---- ランク計算 ----
  const currentRank = getRankByLevel(profile?.rank_level ?? 1);
  const nextRank = getNextRank(currentRank.level);

  // ---- 紹介 ----
  const rewardedCount = (referrals ?? []).filter((r: { status: string }) => r.status === "rewarded").length;
  const totalPoints = rewardedCount * 200;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const referralUrl = `${siteUrl}/login?ref=${profile?.referral_code}`;

  // ---- バッジ集計 ----
  // 今月確定した予約（created_at ベース）
  const thisMonthBookings = (bookings ?? []).filter(
    (b: { created_at: string }) => b.created_at >= monthStart && b.created_at <= monthEnd
  );
  const monthlyEventCount = thisMonthBookings.length;
  const monthlyEventTypes = new Set(
    thisMonthBookings
      .map((b: { events: { event_type: string } | null }) => b.events?.event_type)
      .filter(Boolean)
  );

  // 今月 rewarded の紹介数
  const monthlyReferralCount = (referrals ?? []).filter(
    (r: { status: string; rewarded_at: string | null }) =>
      r.status === "rewarded" && r.rewarded_at && r.rewarded_at >= monthStart
  ).length;

  // 今月獲得済みバッジ ID
  const earnedThisMonthIds = new Set(
    (userBadges ?? [])
      .filter((ub) => (ub as unknown as UserBadgeRow).period === thisMonth)
      .map((ub) => (ub as unknown as UserBadgeRow).badge_id)
  );

  // condition_type + conditionValue でバッジを検索するヘルパー
  function findBadge(conditionType: string, value: number): BadgeRow | null {
    return (
      (allBadges ?? []).find(
        (b: BadgeRow) => b.condition_type === conditionType && b.condition_value === value
      ) ?? null
    );
  }

  function isEarned(conditionType: string, value: number): boolean {
    const b = findBadge(conditionType, value);
    return b ? earnedThisMonthIds.has(b.id) : false;
  }

  // ---- クラス種別バッジ ----
  const eventTypeTracks = [
    { label: "Running", conditionType: "monthly_first_running", hasType: monthlyEventTypes.has("running") },
    { label: "Yoga",    conditionType: "monthly_first_yoga",    hasType: monthlyEventTypes.has("yoga") },
    { label: "Training",conditionType: "monthly_first_training",hasType: monthlyEventTypes.has("training") },
    { label: "Boxing",  conditionType: "monthly_first_boxing",  hasType: monthlyEventTypes.has("boxing") },
  ];

  // ---- 参加回数バッジ（3 → 5） ----
  const earned3 = isEarned("monthly_event_count", 3);
  const earned5 = isEarned("monthly_event_count", 5);
  // 次のターゲット: 3未達なら3, 3達成なら5, 5達成なら5（満了）
  const countTarget = earned5 ? 5 : earned3 ? 5 : 3;
  const countTargetBadge = findBadge("monthly_event_count", countTarget);

  // ---- リファラルバッジ（1 → 3 → 5） ----
  const earnedRef1 = isEarned("monthly_referral_count", 1);
  const earnedRef3 = isEarned("monthly_referral_count", 3);
  const earnedRef5 = isEarned("monthly_referral_count", 5);
  const refTarget = earnedRef5 ? 5 : earnedRef3 ? 5 : earnedRef1 ? 3 : 1;
  const refTargetBadge = findBadge("monthly_referral_count", refTarget);

  // ---- 今月獲得バッジ一覧（アイコン表示用） ----
  const earnedThisMonthBadges = (userBadges ?? [])
    .filter((ub) => (ub as unknown as UserBadgeRow).period === thisMonth)
    .map((ub) => {
      const row = (ub as unknown as UserBadgeRow).badges;
      return Array.isArray(row) ? row[0] : row;
    })
    .filter((b): b is BadgeRow => Boolean(b));

  // ---- バッジ獲得数ボーナス進捗（3個:300pt / 5個:500pt / 9個:1000pt、最高ティアのみ翌月1日に付与） ----
  const BADGE_BONUS_TIERS = [
    { count: 3, points: 300 },
    { count: 5, points: 500 },
    { count: 9, points: 1000 },
  ];
  const earnedBadgeCount = earnedThisMonthBadges.length;
  const nextBonusTier = BADGE_BONUS_TIERS.find((t) => earnedBadgeCount < t.count) ?? null;
  const achievedBonusTier = [...BADGE_BONUS_TIERS].reverse().find((t) => earnedBadgeCount >= t.count) ?? null;

  // バッジ初文字マップ
  const BADGE_INITIALS: Record<string, string> = {
    monthly_first_running:  "Run",
    monthly_first_yoga:     "Yog",
    monthly_first_training: "Trn",
    monthly_first_boxing:   "Box",
    monthly_event_count:    "",    // value で上書き
    monthly_referral_count: "",
  };

  function badgeInitial(b: BadgeRow): string {
    if (b.condition_type === "monthly_event_count") return `×${b.condition_value}`;
    if (b.condition_type === "monthly_referral_count") return `${b.condition_value}人`;
    return BADGE_INITIALS[b.condition_type] ?? b.name.charAt(0);
  }

  return (
    <main className="relative min-h-screen app-bg pb-24">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-10 space-y-6">

        {/* ランク + 累計参加数 */}
        <div className="bg-sage-300 text-white rounded-2xl shadow-[0_1px_4px_rgba(44,53,49,0.08)] px-4 py-3 animate-fade-up animate-delay-100">
          <div className="mb-2">
            <p className="font-dm text-xs text-white/70">現在のランク</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <RankIcon level={currentRank.level} size={16} />
              <p className="font-outfit text-lg font-bold leading-tight">{currentRank.nameEn}</p>
            </div>
            <p className="font-outfit text-xs text-white/70">{currentRank.nameJa}</p>
          </div>
          <div className="flex gap-5 mb-2">
            <div>
              <p className="font-dm text-xs text-white/70">累計参加回数</p>
              <div className="flex items-baseline gap-1">
                <p className="font-outfit text-xl font-bold">{totalCount}</p>
                <p className="font-dm text-white/70 text-xs">回</p>
              </div>
            </div>
            <div>
              <p className="font-dm text-xs text-white/70">ポイント残高</p>
              <div className="flex items-baseline gap-1">
                <p className="font-outfit text-xl font-bold">{(profile?.points ?? 0).toLocaleString()}</p>
                <p className="font-dm text-white/70 text-xs">pt</p>
              </div>
            </div>
          </div>

          <div>
            {nextRank ? (
              <>
                <div className="flex justify-between mb-1">
                  <span className="font-dm text-xs text-white/70">{currentRank.nameEn}</span>
                  <span className="font-dm text-xs text-white/70">{nextRank.nameEn}</span>
                </div>
                <div className="w-full bg-white/25 rounded-full h-1 mb-1">
                  <div
                    className="bg-white rounded-full h-1 transition-all"
                    style={{ width: `${Math.min(((totalCount - currentRank.minCount) / (nextRank.minCount - currentRank.minCount)) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="font-dm text-xs text-white/70">
                    参加 {totalCount} / {nextRank.minCount}回
                    {totalCount >= nextRank.minCount && <span className="text-white ml-1">✓</span>}
                  </span>
                  {nextRank.minReferrals > 0 && (
                    <span className="font-dm text-xs text-white/70">
                      インパクト {rewardedCount} / {nextRank.minReferrals}人
                      {rewardedCount >= nextRank.minReferrals && <span className="text-white ml-1">✓</span>}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="font-dm text-xs text-white/70 text-center">最高ランク到達</p>
            )}
          </div>
        </div>

        {/* ランク一覧 */}
        <div className="nm-card px-4 py-4 sm:px-6 sm:py-5 animate-fade-up animate-delay-150">
          <h2 className="font-outfit font-semibold text-base text-ink-700 mb-3">ランク</h2>
          <div className="space-y-1">
            {RANKS.map((rank) => {
              const isCurrent = rank.level === currentRank.level;
              return (
                <div
                  key={rank.level}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition ${
                    isCurrent
                      ? "bg-sage-300 text-white shadow-[4px_4px_10px_#3D483F,-2px_-2px_6px_#95AB9B]"
                      : "nm-card-sm"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-outfit text-xs font-semibold w-4 shrink-0 text-center ${isCurrent ? "text-white/70" : "text-ink-300"}`}>
                      {rank.level}
                    </span>
                    <div className="flex items-center gap-1 min-w-0">
                      <RankIcon level={rank.level} size={13} className={isCurrent ? "text-white" : "text-ink-300"} />
                      <p className={`font-outfit font-semibold text-sm truncate ${isCurrent ? "text-white" : "text-ink-300"}`}>{rank.nameEn}</p>
                      <p className={`font-dm text-xs shrink-0 ${isCurrent ? "text-white/70" : "text-ink-300"}`}>（{rank.nameJa}）</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {rank.minCount > 0 && (
                      <p className={`font-dm text-xs leading-tight ${isCurrent ? "text-white/70" : "text-ink-300"}`}>
                        {`${rank.minCount}回〜`}
                      </p>
                    )}
                    {rank.minReferrals > 0 && (
                      <p className={`font-dm text-xs leading-tight ${isCurrent ? "text-white/70" : "text-ink-300"}`}>
                        {`紹介 ${rank.minReferrals}人〜`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 月間バッジ */}
        <div className="nm-card px-4 py-4 sm:px-6 sm:py-5 animate-fade-up animate-delay-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-outfit font-semibold text-base text-ink-700">月間バッジ</h2>
            <p className="font-dm text-xs text-ink-300">{now.getMonth() + 1}月</p>
          </div>

          {/* クラス初参加 */}
          <span className="inline-block font-outfit text-xs font-semibold text-white uppercase tracking-wider bg-sage-300 rounded-full px-3 py-1 mb-2">クラス初参加</span>
          <div className="space-y-2 mb-6">
            {eventTypeTracks.map((track) => {
              const b = findBadge(track.conditionType, 1);
              const earned = b ? earnedThisMonthIds.has(b.id) : false;
              const initial = BADGE_INITIALS[track.conditionType] ?? track.label.slice(0, 3);
              return (
                <MeterRow
                  key={track.conditionType}
                  label={track.label}
                  current={track.hasType ? 1 : 0}
                  max={1}
                  badgeInitial={initial}
                  earned={earned}
                  sublabel={track.hasType ? "達成" : "0 / 1回"}
                />
              );
            })}
          </div>

          {/* 参加回数 */}
          <span className="inline-block font-outfit text-xs font-semibold text-white uppercase tracking-wider bg-sage-300 rounded-full px-3 py-1 mb-2">参加回数</span>
          <div className="mb-6">
            {countTargetBadge && (
              <MeterRow
                label="クラス参加"
                current={monthlyEventCount}
                max={countTarget}
                badgeInitial={`×${countTarget}`}
                earned={earned5}
                sublabel={`${monthlyEventCount} / ${countTarget}回`}
              />
            )}
          </div>

          {/* 友人紹介 */}
          <span className="inline-block font-outfit text-xs font-semibold text-white uppercase tracking-wider bg-sage-300 rounded-full px-3 py-1 mb-2">友人紹介</span>
          <div className="mb-6">
            {refTargetBadge && (
              <MeterRow
                label="友人紹介"
                current={monthlyReferralCount}
                max={refTarget}
                badgeInitial={`${refTarget}人`}
                earned={earnedRef5}
                sublabel={`${monthlyReferralCount} / ${refTarget}人`}
              />
            )}
          </div>

          {/* 獲得バッジ */}
          <div className="border-t border-base-200 pt-3">
            <p className="font-outfit text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">獲得バッジ</p>
            {earnedThisMonthBadges.length > 0 ? (
              <div className="flex flex-wrap gap-x-3 gap-y-3">
                {earnedThisMonthBadges.map((b: BadgeRow) => (
                  <div key={b.id} className="flex flex-col items-center gap-1 w-16 shrink-0">
                    <div className="w-9 h-9 rounded-full bg-sage-600 text-white flex items-center justify-center font-outfit font-bold text-xs shadow-sm shrink-0">
                      {badgeInitial(b)}
                    </div>
                    <p className="font-dm text-[10px] text-ink-300 text-center leading-tight break-words w-full">{b.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-dm text-xs text-ink-300">まだバッジを獲得していません</p>
            )}
          </div>

          {/* バッジ獲得数ボーナス */}
          <div className="border-t border-base-200 pt-3 mt-3">
            <p className="font-outfit text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">バッジボーナス</p>
            <p className="font-dm text-xs text-ink-500 mb-1">
              今月の獲得バッジ数：<span className="font-outfit font-bold text-ink-700">{earnedBadgeCount}個</span>
            </p>
            {nextBonusTier ? (
              <p className="font-dm text-xs text-ink-300">
                あと{nextBonusTier.count - earnedBadgeCount}個で
                <span className="text-sage-600 font-semibold">{nextBonusTier.points}pt</span>
                ボーナス（翌月1日に付与）
              </p>
            ) : (
              <p className="font-dm text-xs text-ink-300">
                最高ティア達成：
                <span className="text-sage-600 font-semibold">{achievedBonusTier?.points}pt</span>
                ボーナス確定（翌月1日に付与）
              </p>
            )}
          </div>
        </div>

        {/* 紹介セクション */}
        <div className="bg-sage-300 text-white rounded-2xl px-4 py-4 animate-fade-up">
          <p className="font-outfit font-semibold text-base mb-2">友達を紹介してポイントをゲット</p>
          <div className="space-y-1.5 font-dm text-xs text-white/70">
            <div className="flex items-center gap-2">
              <span className="bg-white text-ink-700 font-outfit font-bold rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0">1</span>
              <p>あなたの紹介リンクを友達にシェア</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white text-ink-700 font-outfit font-bold rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0">2</span>
              <p>友達がリンクから登録・初回参加を完了</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white text-ink-700 font-outfit font-bold rounded-full w-4 h-4 flex items-center justify-center text-xs flex-shrink-0">3</span>
              <p>あなたと友達に <strong className="text-white font-outfit">それぞれ200ポイント</strong> が付与されます</p>
            </div>
          </div>
        </div>

        {/* 紹介コード・シェアボタン */}
        <div className="nm-card px-4 py-3">
          <p className="font-outfit text-xs text-ink-300 mb-1">あなたの紹介コード</p>
          <p className="font-outfit font-bold text-xl text-ink-700 tracking-widest mb-2">{profile?.referral_code}</p>
          <ReferralShare referralUrl={referralUrl} code={profile?.referral_code ?? ""} />
        </div>

        {/* 紹介実績 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="nm-card p-3 text-center">
            <p className="font-outfit text-2xl font-bold text-ink-700">{(referrals ?? []).length}</p>
            <p className="font-dm text-xs text-ink-300 mt-1">紹介した人数</p>
          </div>
          <div className="nm-card p-3 text-center">
            <p className="font-outfit text-2xl font-bold text-ink-500">{rewardedCount}</p>
            <p className="font-dm text-xs text-ink-300 mt-1">初回参加完了</p>
          </div>
          <div className="nm-card p-3 text-center">
            <p className="font-outfit text-2xl font-bold text-ink-700">{totalPoints}</p>
            <p className="font-dm text-xs text-ink-300 mt-1">獲得ポイント</p>
          </div>
        </div>

        {/* 紹介履歴 */}
        <div className="nm-card p-6">
          <h2 className="font-outfit font-semibold text-lg text-ink-700 mb-4">紹介履歴</h2>
          {(referrals ?? []).length > 0 ? (
            <div className="space-y-3">
              {(referrals ?? []).map((r: { id: string; referee_id: string; created_at: string; status: string }) => {
                const refNameEncrypted = referredNameMap.get(r.referee_id);
                const refName = refNameEncrypted ? decrypt(refNameEncrypted) : null;
                return (
                  <div key={r.id} className="nm-card-sm flex items-center justify-between p-3">
                    <div>
                      <p className="font-outfit font-medium text-sm text-ink-700">{refName ?? "ユーザー"}</p>
                      <p className="font-dm text-xs text-ink-300">
                        {new Date(r.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })} 登録
                      </p>
                    </div>
                    <span className={`font-outfit text-xs font-medium px-3 py-1 rounded-full ${
                      r.status === "rewarded"
                        ? "bg-base-100 text-ink-700"
                        : "bg-base-100 text-ink-300"
                    }`}>
                      {r.status === "rewarded" ? "完了 +200pt" : "参加待ち"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="font-dm text-sm text-ink-300 text-center py-6">
              まだ紹介した友達はいません
            </p>
          )}
        </div>

      </div>
      <BottomNav />
    </main>
  );
}
