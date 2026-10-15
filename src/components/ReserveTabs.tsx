import Link from "next/link";

const TABS = [
  { key: "events", href: "/events", label: "イベントを探す" },
  { key: "bookings", href: "/bookings", label: "予約済み" },
] as const;

// 下ナビ「予約」の中で、イベント一覧（/events）と予約済み一覧（/bookings）を切り替える
export default function ReserveTabs({ active }: { active: "events" | "bookings" }) {
  return (
    <div className="grid grid-cols-2 gap-1 bg-white border border-base-200 rounded-full p-1">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={`text-center font-outfit text-sm py-2 rounded-full transition ${
              selected ? "bg-sage-600 text-white font-medium" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
