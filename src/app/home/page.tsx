import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkAndAwardPendingPoints } from "@/lib/points";
import { getRankByLevel, getNextRank } from "@/lib/ranks";
import { decrypt } from "@/lib/encrypt";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import JournalQuickEntry from "./JournalQuickEntry";
import RankIcon from "@/components/RankIcon";
import RankUpModal from "./RankUpModal";
import RankGuideModal from "./RankGuideModal";
import { getTodayJst, getJstParts } from "@/lib/date";

const MOCK_PROFILE = { name: "Tsubasa Yamamoto", points: 120, created_at: "2026-01-15T00:00:00Z" };

function formatDateTime(iso: string) {
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const { year: y, month, day: d, hours: h, minutes: mi, dayOfWeek } = getJstParts(new Date(iso));
  const mo = String(month).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  const min = String(mi).padStart(2, "0");
  return `${y}/${mo}/${day}（${DAYS[dayOfWeek]}） ${h % 12 || 12}:${min} ${h < 12 ? "AM" : "PM"}`;
}

export default async function HomePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = getTodayJst();
  const now = new Date().toISOString();

  await checkAndAwardPendingPoints(supabase, user.id);

  const [profileRes, sessionRes, eventsRes, journalRes, bookingsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "confirmed").not("checked_in_at", "is", null),
    supabase.from("events").select("*").eq("status", "published").gt("start_at", now).order("start_at", { ascending: true }).limit(1),
    supabase.from("journals").select("id").eq("user_id", user.id).eq("recorded_at", today).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, event_id, events(title, start_at, location)")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("created_at", { ascending: true }),
  ]);

  const profileRaw = profileRes.data ?? MOCK_PROFILE;
  const profile = {
    ...profileRaw,
    name: profileRaw.name ? decrypt(profileRaw.name) : profileRaw.name,
    name_roman: profileRaw.name_roman ? decrypt(profileRaw.name_roman) : profileRaw.name_roman,
  };
  const sessionCount = sessionRes.count ?? 0;
  const nextEvent = eventsRes.data?.[0] ?? null;
  const todayJournal = journalRes.data;

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
  const upcomingBookings: Booking[] = ((bookingsRes.data ?? []) as unknown as BookingRaw[])
    .map((b) => {
      const ev = Array.isArray(b.events) ? b.events[0] : b.events;
      return ev ? { id: b.id, event_id: b.event_id, events: ev } : null;
    })
    .filter((b): b is Booking => {
      if (!b) return false;
      const endAt = new Date(b.events.start_at);
      endAt.setHours(endAt.getHours() + 2);
      return endAt > new Date();
    });

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
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-5">

        {/* プロフィールカード */}
        <div className="bg-sage-300 text-white rounded-[20px] p-4 shadow-[2px_2px_6px_#3D483F,-1px_-1px_3px_#95AB9B] animate-fade-up animate-delay-100">
          <div className="flex items-center justify-between gap-3">
            <p className="font-dm text-xs text-white/70">Member since {memberSince}</p>
            <div className="flex items-center gap-1">
              <RankIcon level={currentRank.level} size={14} />
              <p className="font-outfit text-sm font-bold leading-tight">{currentRank.nameEn}</p>
              <p className="font-outfit text-xs text-white/70">（{currentRank.nameJa}）</p>
            </div>
          </div>
          <p className="font-outfit text-xl font-semibold tracking-wide mt-2 truncate">{profile.nickname || profile.name_roman || profile.name || "User"}</p>

          <div className="flex items-center gap-6 mt-3">
            <div>
              <p className="font-outfit text-2xl font-bold">{sessionCount}</p>
              <p className="font-dm text-xs text-white/70 mt-0.5">累計参加数</p>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div>
              <p className="font-outfit text-2xl font-bold">{profile.points ?? 0}</p>
              <p className="font-dm text-xs text-white/70 mt-0.5">Points</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            {nextRank && countToNext !== null && countToNext > 0 ? (
              <p className="font-dm text-xs text-white/70">
                次のランク <span className="text-white font-outfit font-semibold">{nextRank.nameEn}</span> まであと {countToNext} 回
              </p>
            ) : (
              <p className="font-dm text-xs text-white/70">最高ランク到達</p>
            )}
            <RankGuideModal currentLevel={currentRank.level} />
          </div>
        </div>

        {/* 予約済みイベント */}
        {upcomingBookings.length > 0 && (
          <div className="animate-fade-up animate-delay-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-outfit text-sm font-semibold text-ink-500 tracking-wide">予約済みイベント</h2>
              <Link href="/bookings" className="font-outfit text-xs text-ink-500 font-medium">
                すべて見る →
              </Link>
            </div>
            <div className="space-y-3">
              {upcomingBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={`/events/${booking.event_id}`}
                  className="nm-card-sm flex items-center justify-between p-3 transition"
                >
                  <div>
                    <p className="font-outfit font-medium text-sm text-ink-700">{booking.events.title}</p>
                    <p className="font-dm text-xs text-ink-300">{formatDateTime(booking.events.start_at)}</p>
                  </div>
                  <span className="font-outfit text-xs text-ink-700 font-medium bg-sage-200 px-2 py-1 rounded-full shrink-0">予約済み</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 次回イベント */}
        <div className="animate-fade-up animate-delay-200">
          <h2 className="font-outfit text-sm font-semibold text-ink-500 mb-3 tracking-wide">次回のイベント</h2>
          {nextEvent ? (
            <Link
              href={`/events/${nextEvent.id}`}
              className="block nm-card p-4 transition"
            >
              <p className="font-outfit font-semibold text-ink-700">{nextEvent.title}</p>
              <p className="font-dm text-xs text-ink-300 mt-1">{formatDateTime(nextEvent.start_at)}</p>
              <p className="font-dm text-xs text-ink-300">{nextEvent.location}</p>
              <p className="font-outfit text-xs text-ink-500 font-medium mt-3">詳細を見る →</p>
            </Link>
          ) : (
            <div className="nm-card p-6 text-center">
              <p className="font-dm text-sm text-ink-300">現在開催予定のイベントはありません</p>
            </div>
          )}
        </div>

        {/* ジャーナル */}
        <div className="animate-fade-up animate-delay-300">
          <JournalQuickEntry alreadyRecorded={!!todayJournal} />
        </div>

      </div>

      <BottomNav />
    </main>
  );
}
