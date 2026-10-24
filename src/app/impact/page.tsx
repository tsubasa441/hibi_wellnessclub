import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import AppFooter from "@/components/AppFooter";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import RankGuideModal from "@/components/RankGuideModal";
import ReferralShare from "@/app/impact/ReferralShare";
import GrowthRings from "@/app/impact/GrowthRings";
import ReachRipple from "@/app/impact/ReachRipple";
import { getRankByLevel, getNextRank } from "@/lib/ranks";
import { countReferralReach } from "@/lib/referrals";
import { createServiceClient } from "@/lib/supabase/service";
import { getYearMonthJst, getJstParts } from "@/lib/date";

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

// ---- バッジのスタンプ（Server Component） ----
// 取得済みは塗り（クラス初参加は種別の色）、未取得は点線の輪
function BadgeStamp({ mark, name, earned, earnedClass }: { mark: string; name: string; earned: boolean; earnedClass: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 min-w-0">
      <span
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-outfit font-semibold text-xs ${
          earned ? `${earnedClass} text-white` : "border-[1.5px] border-dashed border-base-300 text-ink-400"
        }`}
      >
        {mark}
      </span>
      <span className={`font-outfit text-[10px] leading-tight text-center ${earned ? "text-ink-700 font-medium" : "text-ink-400"}`}>
        {name}
      </span>
      <span className="sr-only">{earned ? "獲得済み" : "未獲得"}</span>
    </li>
  );
}

export default async function ImpactPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const now = new Date();
  const thisMonth = getYearMonthJst(now);

  const [
    { data: profile },
    { data: bookings },
    { data: userBadges },
    { data: allBadges },
    referralReach,
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
    countReferralReach(createServiceClient(), user.id),
  ]);

  // チェックイン済みの予約のみを「参加」としてカウントする
  const checkedInBookings = (bookings ?? []).filter(
    (b: { checked_in_at: string | null }) => b.checked_in_at != null
  );
  const totalCount = checkedInBookings.length;

  // ---- ランク計算 ----
  const currentRank = getRankByLevel(profile?.rank_level ?? 1);
  const nextRank = getNextRank(currentRank.level);
  const countToNext = nextRank ? nextRank.minCount - totalCount : null;

  // ---- 紹介 ----
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const referralUrl = `${siteUrl}/login?ref=${profile?.referral_code}`;

  // ---- バッジ集計 ----
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

  // ---- スタンプカード（10個） ----
  const STAMPS = [
    { conditionType: "monthly_first_running",  value: 1, mark: "Run",  name: "Running",  earnedClass: "bg-event-running" },
    { conditionType: "monthly_first_yoga",     value: 1, mark: "Yoga", name: "Yoga",     earnedClass: "bg-event-yoga" },
    { conditionType: "monthly_first_training", value: 1, mark: "Trn",  name: "Training", earnedClass: "bg-event-training" },
    { conditionType: "monthly_first_boxing",   value: 1, mark: "Box",  name: "Boxing",   earnedClass: "bg-event-boxing" },
    { conditionType: "monthly_first_pilates",  value: 1, mark: "Pil",  name: "Pilates",  earnedClass: "bg-event-pilates" },
    { conditionType: "monthly_event_count",    value: 3, mark: "×3",   name: "3回参加",  earnedClass: "bg-sage-600" },
    { conditionType: "monthly_event_count",    value: 5, mark: "×5",   name: "5回参加",  earnedClass: "bg-sage-600" },
    { conditionType: "monthly_referral_count", value: 1, mark: "1人",  name: "1人招待",  earnedClass: "bg-ink-500" },
    { conditionType: "monthly_referral_count", value: 3, mark: "3人",  name: "3人招待",  earnedClass: "bg-ink-500" },
    { conditionType: "monthly_referral_count", value: 5, mark: "5人",  name: "5人招待",  earnedClass: "bg-ink-500" },
  ];

  // ---- 今月獲得したバッジの数とボーナス（3個:300pt / 5個:500pt / 9個:1000pt、最高ティアのみ翌月1日に付与） ----
  const earnedBadgeCount = (userBadges ?? []).filter(
    (ub) => (ub as unknown as UserBadgeRow).period === thisMonth
  ).length;
  const BADGE_BONUS_TIERS = [
    { count: 3, points: 300 },
    { count: 5, points: 500 },
    { count: 9, points: 1000 },
  ];
  const BONUS_SLOTS = 9;
  const nextBonusTier = BADGE_BONUS_TIERS.find((t) => earnedBadgeCount < t.count) ?? null;
  const achievedBonusTier = [...BADGE_BONUS_TIERS].reverse().find((t) => earnedBadgeCount >= t.count) ?? null;
  const bonusSlots = Array.from({ length: BONUS_SLOTS }, (_, i) => ({
    filled: i < earnedBadgeCount,
    tier: BADGE_BONUS_TIERS.find((t) => t.count === i + 1) ?? null,
  }));

  // ---- 年輪：次のランクへの進み具合 ----
  const rankProgress = nextRank
    ? (totalCount - currentRank.minCount) / Math.max(nextRank.minCount - currentRank.minCount, 1)
    : 1;
  const month = getJstParts(now).month;

  return (
    <main className="relative min-h-screen app-bg flex flex-col">
      <Header />

      <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5">

        {/* 年輪：ランクと累計参加 */}
        <section aria-label="あなたの年輪" className="bg-sage-600 text-white -mx-4 sm:mx-0 px-4 py-4 sm:px-8 sm:py-6 overflow-hidden animate-fade-up animate-delay-100">
          {/* スマホも横並びにして高さを詰める（2026-10-24、高いとの指摘で縦並びから変更） */}
          <div className="flex items-center gap-4 sm:gap-8">
            <GrowthRings level={currentRank.level} progress={rankProgress} />
            <div className="min-w-0 flex-1 flex flex-col gap-2 sm:gap-2.5 text-left">
              <div>
                <p className="font-outfit text-xs text-white/80">いまのランク</p>
                <p className="font-outfit text-2xl font-semibold leading-tight">
                  {currentRank.nameEn}
                  <span className="text-base font-normal text-white/80 ml-1.5">{currentRank.nameJa}</span>
                </p>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-bebas text-5xl sm:text-6xl leading-[0.8]">{totalCount}</span>
                <span className="font-outfit text-sm pb-1">回、体を動かしました</span>
              </div>
              <p className="font-dm text-sm text-white">
                {nextRank && countToNext !== null && countToNext > 0
                  ? `あと${countToNext}回で ${nextRank.nameEn}（${nextRank.nameJa}）`
                  : "最高ランクに到達しています"}
              </p>
              <div className="flex items-center gap-4 pt-1">
                <span className="font-outfit text-sm bg-white/15 rounded-full px-3 py-1">
                  <span className="font-semibold">{profile?.points ?? 0}</span> pt
                </span>
                <RankGuideModal
                  currentLevel={currentRank.level}
                  triggerClassName="font-dm text-xs text-white underline underline-offset-2 hover:text-sage-50 transition"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 今月のバッジ：スタンプカード */}
        <section aria-label={`${month}月のバッジ`} className="bg-white -mx-4 sm:mx-0 px-4 py-5 sm:px-7 animate-fade-up animate-delay-200">
          <h2 className="font-outfit font-semibold text-base text-ink-700 mb-4">{month}月のバッジ</h2>

          <ul className="grid grid-cols-5 gap-x-2 gap-y-4">
            {STAMPS.map((s) => (
              <BadgeStamp
                key={`${s.conditionType}-${s.value}`}
                mark={s.mark}
                name={s.name}
                earned={isEarned(s.conditionType, s.value)}
                earnedClass={s.earnedClass}
              />
            ))}
          </ul>

          {/* バッジボーナス：9マスの目盛り */}
          <div className="mt-6 pt-5 border-t border-base-200">
            <div className="flex items-baseline justify-between mb-2">
              <p className="font-outfit text-sm font-medium text-ink-700">バッジボーナス</p>
              <p className="font-dm text-xs text-ink-400">
                {nextBonusTier
                  ? `あと${nextBonusTier.count - earnedBadgeCount}個で${nextBonusTier.points}pt`
                  : `${achievedBonusTier?.points}pt 確定`}
              </p>
            </div>
            <ol className="grid grid-cols-9 gap-1" aria-label={`今月の獲得バッジ ${earnedBadgeCount}個`}>
              {bonusSlots.map((slot, i) => (
                <li key={i} className="flex flex-col items-center gap-1">
                  <span className={`h-2.5 w-full ${slot.filled ? "bg-sage-600" : "bg-base-200"}`} />
                  <span className={`font-outfit text-[10px] h-3 ${slot.tier ? (slot.filled ? "text-sage-600 font-semibold" : "text-ink-400") : "text-transparent"}`}>
                    {slot.tier ? `${slot.tier.points}` : "-"}
                  </span>
                </li>
              ))}
            </ol>
            <p className="font-dm text-xs text-ink-400 mt-1">獲得したバッジの数に応じて、翌月1日にポイントが届きます</p>
          </div>
        </section>

        {/* あなたから広がった幸せ・招待 */}
        <section aria-label="あなたから広がった幸せ" className="bg-white -mx-4 sm:mx-0 px-4 py-5 sm:px-7 animate-fade-up">
          <div className="flex items-center gap-4">
            <ReachRipple count={referralReach} />
            <div className="min-w-0">
              <p className="font-bebas text-6xl leading-[0.85] text-sage-600">{referralReach}</p>
              <p className="font-outfit text-sm font-medium text-ink-700 mt-1">
                あなたから広がった<span className="inline-block">幸せの数</span>
              </p>
              <p className="font-dm text-xs text-ink-400 mt-1">
                {referralReach > 0 ? "あなたが誘った人と、その先に広がった人です" : "最初の1人を誘ってみませんか"}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-base-200">
            <p className="font-outfit font-semibold text-base text-ink-700">大切な人を、新しい日常へ</p>
            <ol className="mt-3 space-y-2">
              {[
                "あなたの紹介リンクを友達に送る",
                "友達がリンクから登録し、初めてのイベントにチェックイン",
                "あなたと友達に、それぞれ200ptが届く",
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-2.5 font-dm text-sm text-ink-500">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-sage-100 text-ink-700 font-outfit text-xs font-semibold flex items-center justify-center mt-px">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between gap-3 bg-base-100 px-4 py-3">
              <span className="font-dm text-xs text-ink-400">あなたの紹介コード</span>
              <span className="font-outfit font-semibold text-lg text-ink-700 tracking-widest">{profile?.referral_code}</span>
            </div>
            <div className="mt-3">
              <ReferralShare referralUrl={referralUrl} code={profile?.referral_code ?? ""} />
            </div>
          </div>
        </section>

      </div>
      <AppFooter />
      <BottomNav />
    </main>
  );
}
