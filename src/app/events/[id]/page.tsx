import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingButton from "./BookingButton";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  yoga:     { label: "ヨガ",         color: "bg-sage-100 text-ink-700" },
  training: { label: "トレーニング", color: "bg-sage-100 text-ink-700" },
  running:  { label: "ランニング",   color: "bg-sage-100 text-ink-700" },
  boxing:   { label: "ボクシング",   color: "bg-sage-100 text-ink-700" },
};

function fmt12(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(startStr: string, endStr?: string | null): { date: string; time: string } {
  const d = new Date(startStr);
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = DAYS[d.getDay()];
  const timeStr = endStr
    ? `${fmt12(d)} 〜 ${fmt12(new Date(endStr))}`
    : fmt12(d);
  return {
    date: `${y}/${m}/${day}（${weekday}）`,
    time: timeStr,
  };
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: event }, { count: bookedCount }] = await Promise.all([
    supabase.from("events").select("*").eq("id", params.id).single(),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("event_id", params.id).eq("status", "confirmed"),
  ]);

  if (!event) notFound();

  const remaining = event.capacity - (bookedCount ?? 0);
  const isSoldOut = remaining <= 0;
  const type = EVENT_TYPE_LABELS[event.event_type] ?? { label: event.event_type, color: "bg-base-100 text-ink-500" };

  let userBooking = null;
  if (user) {
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("event_id", params.id)
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .single();
    userBooking = data;
  }

  return (
    <main className="relative min-h-screen app-bg pb-24">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(44,53,49,0.08)] overflow-hidden animate-fade-up animate-delay-100">
          {/* Hero */}
          <div className="bg-gradient-to-br from-ink-800 via-ink-700 to-ink-500 px-6 py-5 text-white">
            <span className={`inline-flex items-center text-xs font-maru font-medium px-3 py-1 rounded-full mb-4 ${type.color}`}>
              {type.label}
            </span>
            <h1 className="font-maru text-2xl font-semibold leading-snug">{event.title}</h1>
          </div>

          {/* Details */}
          <div className="px-6 py-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-base-100 rounded-xl p-4">
                <p className="font-maru text-xs text-ink-400 mb-1">日時</p>
                <p className="font-maru text-sm font-medium text-ink-700">{formatDate(event.start_at, event.end_at).date}</p>
                <p className="font-maru text-sm font-medium text-ink-700">{formatDate(event.start_at, event.end_at).time}</p>
              </div>
              <div className="bg-base-100 rounded-xl p-4">
                <p className="font-maru text-xs text-ink-400 mb-1">場所</p>
                <p className="font-maru text-sm font-medium text-ink-700">{event.location}</p>
              </div>
              <div className="bg-base-100 rounded-xl p-4">
                <p className="font-maru text-xs text-ink-400 mb-1">参加費</p>
                <p className="font-maru text-lg font-bold text-ink-700">
                  {event.price === 0 ? "無料" : `¥${event.price.toLocaleString()}`}
                </p>
              </div>
              <div className="bg-base-100 rounded-xl p-4">
                <p className="font-maru text-xs text-ink-400 mb-1">残り枠</p>
                <p className={`font-maru text-lg font-bold ${isSoldOut ? "text-red-500" : remaining <= 3 ? "text-amber-600" : "text-ink-700"}`}>
                  {isSoldOut ? "満席" : `${remaining} / ${event.capacity} 名`}
                </p>
              </div>
            </div>

            {event.description && (
              <div>
                <p className="font-maru text-xs text-ink-400 mb-2">イベント詳細</p>
                <p className="font-maru text-sm text-ink-500 leading-relaxed">{event.description}</p>
              </div>
            )}

            <div className="bg-base-100 border border-sage-200 rounded-xl p-4 text-sm text-ink-700">
              <p className="font-maru font-semibold mb-1">キャンセルポリシー</p>
              <ul className="font-maru space-y-0.5">
                <li>・イベント当日までキャンセル可能です</li>
                <li>・2日前まで：全額返金</li>
                <li>・前日・当日：返金対象外（キャンセル料100%）</li>
                <li>・悪天候等による中止：時期を問わず全額返金</li>
              </ul>
            </div>

            <BookingButton
              event={event}
              user={user}
              userBooking={userBooking}
              isSoldOut={isSoldOut}
            />
          </div>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
