import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { checkAndAwardPendingPoints } from "@/lib/points";
import { checkAndAwardReferralReward } from "@/lib/referrals";
import { getRankByLevel, getNextRank } from "@/lib/ranks";
import { decrypt } from "@/lib/encrypt";
import AppFooter from "@/components/AppFooter";
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
  // ホームには近い順に3件まで出し、4件目以降は「ほかn件の予約を見る」で開く
  const HOME_BOOKING_LIMIT = 3;
  const shownBookings = upcomingBookings.slice(0, HOME_BOOKING_LIMIT);
  const hiddenBookings = upcomingBookings.slice(HOME_BOOKING_LIMIT);

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
    // 背景はトップと同じ nav-bg（ログイン前の雰囲気に揃える。依頼者の指定、2026-10-21）
    <main className="relative min-h-screen bg-nav-bg flex flex-col">
      {showRankUpModal && <RankUpModal rank={currentRank} />}
      <RefreshAt at={nextEndMs ? new Date(nextEndMs).toISOString() : null} />
      <Header />

      <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5">

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
            <h2 className="font-zenkaku text-base font-normal text-ink-700 tracking-wide mb-3">予約済みイベント</h2>
            <div className="space-y-3">
              {shownBookings.map((booking) => (
                <EventCard key={booking.id} event={booking.events} href={`/events/${booking.event_id}`} />
              ))}
            </div>
            {hiddenBookings.length > 0 && (
              // 4件目以降はその場で開いて全件を見られるようにする（JS不要の details/summary）
              <details className="group mt-3">
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-center justify-center gap-1.5 min-h-11 rounded-full border border-base-300 bg-white font-outfit text-sm font-medium text-ink-700 hover:border-sage-300 transition">
                  <span className="group-open:hidden">ほか{hiddenBookings.length}件の予約を見る</span>
                  <span className="hidden group-open:inline">閉じる</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="space-y-3 mt-3">
                  {hiddenBookings.map((booking) => (
                    <EventCard key={booking.id} event={booking.events} href={`/events/${booking.event_id}`} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* 次回イベント */}
        <div className="animate-fade-up animate-delay-200">
          <h2 className="font-zenkaku text-base font-normal text-ink-700 tracking-wide mb-3">次回のイベント</h2>
          {nextEvent ? (
            <EventCard event={nextEvent} href={`/events/${nextEvent.id}`} />
          ) : (
            <div className="bg-white border border-base-200 rounded-2xl p-6 text-center">
              <p className="font-dm text-sm text-ink-300">現在開催予定のイベントはありません</p>
            </div>
          )}
        </div>

      </div>

      <AppFooter />
      <BottomNav />
    </main>
  );
}
