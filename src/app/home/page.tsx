import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { checkAndAwardPendingPoints } from "@/lib/points";
import { checkAndAwardReferralReward } from "@/lib/referrals";
import { getRankByLevel, getNextRank } from "@/lib/ranks";
import { decrypt } from "@/lib/encrypt";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import EventCard from "@/components/EventCard";
import ProfileCard from "@/components/ProfileCard";
import RefreshAt from "@/components/RefreshAt";
import RankUpModal from "./RankUpModal";
import { getJstParts } from "@/lib/date";

const MOCK_PROFILE = { name: "Tsubasa Yamamoto", points: 120, created_at: "2026-01-15T00:00:00Z" };

export default async function HomePage() {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");

  const now = new Date().toISOString();

  await Promise.all([
    checkAndAwardPendingPoints(supabase, user.id),
    checkAndAwardReferralReward(createServiceClient(), user.id),
  ]);

  const [profileRes, sessionRes, eventsRes, bookingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed").not("checked_in_at", "is", null),
    supabase.from("events").select("*").eq("status", "published").gt("start_at", now).order("start_at", { ascending: true }).limit(1),
    supabase
      .from("bookings")
      .select("id, event_id, events(title, start_at, end_at, location, event_type)")
      .eq("user_id", user.id)
      .eq("status", "confirmed"),
  ]);

  const profileRaw = profileRes.data ?? MOCK_PROFILE;
  const profile = {
    ...profileRaw,
    name: profileRaw.name ? decrypt(profileRaw.name) : profileRaw.name,
    name_roman: profileRaw.name_roman ? decrypt(profileRaw.name_roman) : profileRaw.name_roman,
  };
  const sessionCount = sessionRes.count ?? 0;
  const nextEvent = eventsRes.data?.[0] ?? null;

  type BookedEvent = { title: string; start_at: string; end_at: string | null; location: string; event_type: string };
  type BookingRaw = {
    id: string;
    event_id: string;
    events: BookedEvent | BookedEvent[] | null;
  };
  type Booking = {
    id: string;
    event_id: string;
    events: BookedEvent;
  };
  const nowMs = new Date().getTime();
  const eventEndMs = (ev: BookedEvent) =>
    ev.end_at ? new Date(ev.end_at).getTime() : new Date(ev.start_at).getTime() + 2 * 60 * 60 * 1000;
  const upcomingBookings: Booking[] = ((bookingsRes.data ?? []) as unknown as BookingRaw[])
    .map((b) => {
      const ev = Array.isArray(b.events) ? b.events[0] : b.events;
      return ev ? { id: b.id, event_id: b.event_id, events: ev } : null;
    })
    .filter((b): b is Booking => b !== null && eventEndMs(b.events) > nowMs)
    .sort((a, b) => a.events.start_at.localeCompare(b.events.start_at));
  const nextEndMs = upcomingBookings.length > 0 ? Math.min(...upcomingBookings.map((b) => eventEndMs(b.events))) : null;
  // ホームには近い順に一部だけ出し、残りは「詳細はこちら」から予約済み画面で見てもらう
  const HOME_BOOKING_LIMIT = 2;
  const shownBookings = upcomingBookings.slice(0, HOME_BOOKING_LIMIT);
  const hiddenBookingCount = upcomingBookings.length - shownBookings.length;

  const memberSince = profile.created_at
    ? (() => {
        const { year, month, day } = getJstParts(new Date(profile.created_at));
        return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}.${year}`;
      })()
    : "";

  const currentRank = getRankByLevel(profile.rank_level ?? 1);
  const nextRank = getNextRank(currentRank.level);
  const countToNext = nextRank ? nextRank.minCount - sessionCount : null;

  const rankNotifiedLevel = profile.rank_notified_level ?? 1;
  const showRankUpModal = (profile.rank_level ?? 1) > rankNotifiedLevel && rankNotifiedLevel > 0;

  return (
    <main className="relative min-h-screen app-bg pb-24">
      {showRankUpModal && <RankUpModal rank={currentRank} />}
      <RefreshAt at={nextEndMs ? new Date(nextEndMs).toISOString() : null} />
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5">

        {/* プロフィールカード */}
        <ProfileCard
          className="animate-fade-up animate-delay-100"
          memberSince={memberSince}
          displayName={profile.nickname || profile.name_roman || profile.name || "User"}
          sessionCount={sessionCount}
          points={profile.points ?? 0}
          currentRank={currentRank}
          nextRank={nextRank}
          countToNext={countToNext}
        />

        {/* 予約済みイベント */}
        {upcomingBookings.length > 0 && (
          <div className="animate-fade-up animate-delay-200">
            <h2 className="font-outfit text-sm font-semibold text-ink-500 tracking-wide mb-3">予約済みイベント</h2>
            <div className="space-y-3">
              {shownBookings.map((booking) => (
                <EventCard key={booking.id} event={booking.events} href={`/events/${booking.event_id}`} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="font-dm text-xs text-ink-400">
                {hiddenBookingCount > 0 ? `ほか${hiddenBookingCount}件の予約があります` : ""}
              </p>
              <Link
                href="/bookings"
                className="font-outfit text-sm font-medium text-white bg-sage-600 rounded-full px-5 py-2.5 min-h-11 flex items-center hover:bg-ink-700 transition"
              >
                詳細はこちら
              </Link>
            </div>
          </div>
        )}

        {/* 次回イベント */}
        <div className="animate-fade-up animate-delay-200">
          <h2 className="font-outfit text-sm font-semibold text-ink-500 mb-3 tracking-wide">次回のイベント</h2>
          {nextEvent ? (
            <EventCard event={nextEvent} href={`/events/${nextEvent.id}`} />
          ) : (
            <div className="bg-white border border-base-200 rounded-2xl p-6 text-center">
              <p className="font-dm text-sm text-ink-300">現在開催予定のイベントはありません</p>
            </div>
          )}
        </div>

      </div>

      <BottomNav />
    </main>
  );
}
