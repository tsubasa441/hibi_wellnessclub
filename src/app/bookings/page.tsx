import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import CancelButton from "@/app/home/CancelButton";
import { getJstParts } from "@/lib/date";

function formatDateTime(iso: string) {
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const { year: y, month, day: dayNum, hours: h, minutes: mi, dayOfWeek } = getJstParts(new Date(iso));
  const mo = String(month).padStart(2, "0");
  const day = String(dayNum).padStart(2, "0");
  const min = String(mi).padStart(2, "0");
  return `${y}/${mo}/${day}（${DAYS[dayOfWeek]}） ${h % 12 || 12}:${min} ${h < 12 ? "AM" : "PM"}`;
}

export default async function BookingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  type BookingRaw = {
    id: string;
    event_id: string;
    events: { title: string; start_at: string; location: string } | { title: string; start_at: string; location: string }[] | null;
  };
  type Booking = {
    id: string;
    event_id: string;
    events: { title: string; start_at: string; location: string };
  };

  const { data } = await supabase
    .from("bookings")
    .select("id, event_id, events(title, start_at, location)")
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  const now = new Date();
  const bookings: Booking[] = ((data ?? []) as unknown as BookingRaw[])
    .map((b) => {
      const ev = Array.isArray(b.events) ? b.events[0] : b.events;
      return ev ? { id: b.id, event_id: b.event_id, events: ev } : null;
    })
    .filter((b): b is Booking => {
      if (!b) return false;
      const endAt = new Date(b.events.start_at);
      endAt.setHours(endAt.getHours() + 2);
      return endAt > now;
    });

  return (
    <main className="relative min-h-screen app-bg pb-24">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/home" className="text-ink-300 hover:text-ink-600 transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="font-outfit text-lg font-semibold text-ink-700">予約済みイベント</h1>
        </div>

        {bookings.length === 0 ? (
          <div className="nm-card p-8 text-center">
            <p className="font-dm text-sm text-ink-300 mb-4">予約中のイベントはありません</p>
            <Link
              href="/events"
              className="inline-block font-outfit text-sm font-medium text-white bg-sage-500 px-6 py-2.5 rounded-full hover:bg-sage-600 transition"
            >
              イベントを探す
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => {
              const startAt = new Date(booking.events.start_at);
              const diffDays = (startAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
              const refundable = diffDays >= 2;
              return (
                <div key={booking.id} className="nm-card-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/events/${booking.event_id}`} className="flex-1 min-w-0">
                      <p className="font-outfit font-semibold text-sm text-ink-700">{booking.events.title}</p>
                      <p className="font-dm text-xs text-ink-300 mt-1">{formatDateTime(booking.events.start_at)}</p>
                      <p className="font-dm text-xs text-ink-300">{booking.events.location}</p>
                    </Link>
                    <span className="font-outfit text-xs font-medium text-ink-700 bg-sage-100 px-2 py-1 rounded-full shrink-0">予約済み</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-base-200">
                    <CancelButton bookingId={booking.id} refundable={refundable} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
