import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import EventTypeIcon from "@/components/EventTypeIcon";
import CheckInButton from "@/app/bookings/CheckInButton";
import { getJstParts, getTodayJst } from "@/lib/date";
import { reconcilePendingPayPayBookings } from "@/lib/paypayReconcile";

type EventInfo = { title: string; start_at: string; end_at: string | null; location: string; event_type: string };
type BookingRaw = { id: string; event_id: string; checked_in_at: string | null; events: EventInfo | EventInfo[] | null };
type Booking = { id: string; event_id: string; checked_in_at: string | null; events: EventInfo };

function formatTime(iso: string) {
  const { hours: h, minutes } = getJstParts(new Date(iso));
  return `${h}:${String(minutes).padStart(2, "0")}`;
}

function formatDate(iso: string) {
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const { month, day, dayOfWeek } = getJstParts(new Date(iso));
  return `${month}月${day}日（${DAYS[dayOfWeek]}）`;
}

function eventEndMs(ev: EventInfo) {
  return ev.end_at ? new Date(ev.end_at).getTime() : new Date(ev.start_at).getTime() + 2 * 60 * 60 * 1000;
}

// 下ナビ中央の「チェックイン」。今日（JST）開催の予約を大きなボタンでチェックインできる
export default async function CheckinPage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const fetchBookings = () =>
    supabase
      .from("bookings")
      .select("id, event_id, checked_in_at, events(title, start_at, end_at, location, event_type)")
      .eq("user_id", user.id)
      .eq("status", "confirmed");

  const [reconciled, firstRes] = await Promise.all([
    reconcilePendingPayPayBookings(supabase, user),
    fetchBookings(),
  ]);
  const data = reconciled > 0 ? (await fetchBookings()).data : firstRes.data;

  const nowMs = new Date().getTime();
  const today = getTodayJst();
  const upcoming: Booking[] = ((data ?? []) as unknown as BookingRaw[])
    .map((b) => {
      const ev = Array.isArray(b.events) ? b.events[0] : b.events;
      return ev ? { id: b.id, event_id: b.event_id, checked_in_at: b.checked_in_at, events: ev } : null;
    })
    .filter((b): b is Booking => b !== null && eventEndMs(b.events) > nowMs)
    .sort((a, b) => a.events.start_at.localeCompare(b.events.start_at));

  // 日付をまたぐイベント（23時開始など）は、0時を過ぎても終了までは開催中としてチェックインできるようにする
  const todays = upcoming.filter(
    (b) => getTodayJst(new Date(b.events.start_at)) === today || new Date(b.events.start_at).getTime() <= nowMs
  );
  const next = todays.length === 0 ? upcoming[0] ?? null : null;

  return (
    <main className="relative min-h-screen app-bg pb-28">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-outfit text-lg font-semibold text-ink-700">チェックイン</h1>
        <p className="font-dm text-xs text-ink-300 mt-1 mb-5">
          会場に着いたら、イベントの開始時刻から終了時刻までの間にチェックインしてください。
        </p>

        {todays.length > 0 ? (
          <div className="space-y-4">
            {todays.map((booking) => (
              <div key={booking.id} className="bg-white border border-base-200 rounded-2xl p-5">
                <Link href={`/events/${booking.event_id}`} className="flex items-start gap-3">
                  <EventTypeIcon type={booking.events.event_type} />
                  <div className="min-w-0">
                    <p className="font-outfit font-semibold text-base text-ink-700">{booking.events.title}</p>
                    <p className="font-dm text-sm text-ink-500 mt-1">
                      {getTodayJst(new Date(booking.events.start_at)) === today ? "本日" : formatDate(booking.events.start_at)}{" "}
                      {formatTime(booking.events.start_at)}
                      {booking.events.end_at ? ` 〜 ${formatTime(booking.events.end_at)}` : " 開始"}
                    </p>
                    <p className="font-dm text-xs text-ink-300">{booking.events.location}</p>
                  </div>
                </Link>
                <div className="mt-5">
                  <CheckInButton
                    bookingId={booking.id}
                    startAt={booking.events.start_at}
                    endAt={booking.events.end_at}
                    checkedInAt={booking.checked_in_at}
                    size="lg"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-base-200 rounded-2xl p-8 text-center">
            <p className="font-dm text-sm text-ink-500">本日チェックインできるイベントはありません</p>
            {next ? (
              <div className="mt-5 pt-5 border-t border-base-200">
                <p className="font-dm text-xs text-ink-300 mb-2">次のご予約</p>
                <Link href={`/events/${next.event_id}`} className="inline-flex items-center gap-3 text-left">
                  <EventTypeIcon type={next.events.event_type} />
                  <div className="min-w-0">
                    <p className="font-outfit font-semibold text-sm text-ink-700">{next.events.title}</p>
                    <p className="font-dm text-xs text-ink-300">
                      {formatDate(next.events.start_at)} {formatTime(next.events.start_at)}
                    </p>
                  </div>
                </Link>
              </div>
            ) : (
              <Link
                href="/events"
                className="inline-block mt-4 font-outfit text-sm font-medium text-white bg-sage-500 px-6 py-2.5 rounded-full hover:bg-sage-600 transition"
              >
                イベントを探す
              </Link>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
