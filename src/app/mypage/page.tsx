import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { decrypt } from "@/lib/encrypt";
import { getRankByLevel } from "@/lib/ranks";
import { getJstParts } from "@/lib/date";
import AppFooter from "@/components/AppFooter";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import RankIcon from "@/components/RankIcon";
import SettingsMenu, { type SavedCard } from "@/components/SettingsMenu";

const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const SHORTCUTS = [
  {
    href: "/bookings",
    label: "予約済み",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M9 16l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "イベントを探す",
    icon: (
      <svg {...iconProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
    ),
  },
  {
    href: "/support",
    label: "お問い合わせ",
    icon: (
      <svg {...iconProps}>
        <path d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1121 12z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.2" />
      </svg>
    ),
  },
];

const LEGAL_LINKS = [
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  { href: "/legal/tokushoho", label: "特定商取引法に基づく表記" },
];

// 下ナビ「マイページ」。プロフィール・お問い合わせ・各種設定（設定は 2026-10-16 にヘッダーの設定ドロワーから移設）
export default async function MyPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const [{ data: profile }, { count: unreadSupport }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, name, name_roman, rank_level, created_at, card_brand, card_last4, card_exp_month, card_exp_year")
      .eq("id", user.id)
      .single(),
    supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("sender", "admin")
      .is("read_by_user_at", null),
  ]);

  const nickname = profile?.nickname ?? "";
  const displayName =
    nickname ||
    (profile?.name_roman ? decrypt(profile.name_roman) : "") ||
    (profile?.name ? decrypt(profile.name) : "") ||
    "User";
  const rank = getRankByLevel(profile?.rank_level ?? 1);
  const memberSince = profile?.created_at
    ? (() => {
        const { year, month, day } = getJstParts(new Date(profile.created_at));
        return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
      })()
    : "";
  const savedCard: SavedCard = profile?.card_last4
    ? {
        brand: profile.card_brand,
        last4: profile.card_last4,
        expMonth: profile.card_exp_month,
        expYear: profile.card_exp_year,
      }
    : null;

  return (
    <main className="relative min-h-screen app-bg flex flex-col">
      <Header />

      <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        {/* プロフィール */}
        <section className="bg-white border border-base-200 rounded-2xl p-5 flex items-center gap-4">
          <Image src="/images/default-avatar.svg" alt="" width={52} height={64} unoptimized className="w-[52px] h-16 shrink-0" />
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 text-sage-600 border border-sage-200 rounded-full px-2.5 py-0.5">
              <RankIcon level={rank.level} size={13} />
              <span className="font-outfit text-xs font-semibold">{rank.nameEn}</span>
              <span className="font-outfit text-[10px] text-sage-600/70">（{rank.nameJa}）</span>
            </div>
            <p className="font-outfit text-xl font-semibold text-ink-700 mt-1.5 truncate">{displayName}</p>
            {user.email && <p className="font-dm text-xs text-ink-300 truncate">{user.email}</p>}
            {memberSince && <p className="font-dm text-[11px] text-ink-300 mt-0.5">Member since {memberSince}</p>}
          </div>
        </section>

        {/* ショートカット */}
        <section className="grid grid-cols-3 gap-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="relative bg-white border border-base-200 rounded-2xl py-4 flex flex-col items-center gap-2 text-ink-500 hover:border-sage-300 hover:text-ink-700 transition"
            >
              {s.href === "/support" && (unreadSupport ?? 0) > 0 && (
                <span
                  aria-label="運営からの未読の返信があります"
                  className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-red-500"
                />
              )}
              {s.icon}
              <span className="font-outfit text-xs font-medium text-ink-700">{s.label}</span>
            </Link>
          ))}
        </section>

        <SettingsMenu nickname={nickname} email={user.email} savedCard={savedCard} />

        {/* その他 */}
        <section>
          <h2 className="font-outfit text-sm font-semibold text-ink-500 tracking-wide mb-2 px-1">その他</h2>
          <div className="bg-white border border-base-200 rounded-2xl overflow-hidden">
            {LEGAL_LINKS.map((l, i) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center justify-between px-5 py-4 hover:bg-base-100 transition ${
                  i < LEGAL_LINKS.length - 1 ? "border-b border-base-200" : ""
                }`}
              >
                <span className="font-outfit text-sm text-ink-700">{l.label}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <AppFooter />
      <BottomNav />
    </main>
  );
}
