export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import EventCard from "@/components/EventCard";
import ReserveTabs from "@/components/ReserveTabs";

export default async function EventsPage() {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .gt("start_at", now)
    .order("start_at", { ascending: true });

  return (
    <main className="relative min-h-screen app-bg pb-24">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <ReserveTabs active="events" />
        </div>

        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up animate-delay-200">
            {events.map((event) => (
              <EventCard key={event.id} event={event} href={`/events/${event.id}`} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-ink-300">
            <p className="font-noto">現在開催予定のイベントはありません</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
