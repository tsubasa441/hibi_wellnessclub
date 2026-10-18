"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  // 「予約」はイベント一覧と予約済み一覧の両方で選択中にする
  matches: string[];
  icon: (active: boolean) => React.ReactNode;
};

const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const LEFT_ITEMS: NavItem[] = [
  {
    href: "/home",
    label: "ホーム",
    matches: ["/home"],
    icon: () => (
      <svg {...svgProps}>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "予約",
    matches: ["/events", "/bookings"],
    icon: () => (
      <svg {...svgProps}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" />
      </svg>
    ),
  },
];

const RIGHT_ITEMS: NavItem[] = [
  {
    href: "/impact",
    label: "インパクト",
    matches: ["/impact"],
    icon: (active) => (
      <svg {...svgProps} fill={active ? "currentColor" : "none"}>
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    href: "/mypage",
    label: "マイページ",
    // お問い合わせ（/support）はマイページから開くため、マイページを選択中にする
    matches: ["/mypage", "/support"],
    icon: () => (
      <svg {...svgProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </svg>
    ),
  },
];

function isActive(pathname: string, item: NavItem) {
  return item.matches.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

function NavLink({ item, pathname, dot = false }: { item: NavItem; pathname: string; dot?: boolean }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={`flex flex-col items-center gap-1 py-2 transition ${active ? "text-sage-600" : "text-ink-300 hover:text-ink-500"}`}
    >
      <span className="relative">
        {item.icon(active)}
        {dot && (
          <span aria-label="未読があります" className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-nav-bg" />
        )}
      </span>
      <span className={`font-outfit text-[10px] whitespace-nowrap ${active ? "font-medium" : ""}`}>{item.label}</span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const checkinActive = pathname === "/checkin";
  const [hasUnreadSupport, setHasUnreadSupport] = useState(false);

  // 運営からの未読の返信があれば「マイページ」に赤い点を付ける。画面を移るたびに確認する。
  // getSession は Cookie を読むだけで通信しない。読み取りは RLS で本人の行のみ
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { count } = await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .eq("sender", "admin")
        .is("read_by_user_at", null);
      if (!cancelled) setHasUnreadSupport((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav className="nm-nav-bottom fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-2xl mx-auto grid grid-cols-5 items-end px-2 pt-1 pb-2 sm:pb-3">
        {LEFT_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {/* チェックイン：画面中央の大きな丸ボタン */}
        <Link href="/checkin" className="group flex flex-col items-center gap-1 -mt-6 focus-visible:outline-none">
          <span
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_12px_rgba(44,53,49,0.25)] ring-4 ring-nav-bg transition-colors duration-200 group-focus-visible:ring-sage-300 ${
              checkinActive ? "bg-sage-600 group-hover:bg-sage-500" : "bg-ink-500 group-hover:bg-sage-600"
            }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" />
              <path d="M8.5 12.5l2.5 2.5 4.5-5" />
            </svg>
          </span>
          <span className={`font-outfit text-[10px] whitespace-nowrap transition-colors duration-200 ${checkinActive ? "text-sage-600 font-medium" : "text-ink-500 group-hover:text-sage-600"}`}>
            チェックイン
          </span>
        </Link>

        {RIGHT_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            dot={item.href === "/mypage" && hasUnreadSupport && pathname !== "/support"}
          />
        ))}
      </div>
    </nav>
  );
}
