import Link from "next/link";

const TABS = [
  { key: "events", href: "/events", label: "イベントを探す" },
  { key: "bookings", href: "/bookings", label: "予約済み" },
] as const;

// 下ナビ「予約」の中で、イベント一覧（/events）と予約済み一覧（/bookings）を切り替える
export default function ReserveTabs({ active }: { active: "events" | "bookings" }) {
  return (
    // 地はグレー、選択中は白（2026-10-25、依頼者の指定。ログイン・新規登録の切り替えと同じ見た目）
    <div className="grid grid-cols-2 gap-1 bg-base-200 rounded-full p-1">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={`text-center font-outfit text-sm py-2 rounded-full transition ${
              selected ? "bg-white text-ink-700 font-medium shadow-[0_1px_3px_rgba(44,53,49,0.15)]" : "text-ink-400 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
