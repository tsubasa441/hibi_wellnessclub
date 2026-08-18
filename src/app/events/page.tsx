export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  yoga:     { label: "ヨガ",         color: "bg-sage-100 text-ink-700" },
  training: { label: "トレーニング", color: "bg-sage-100 text-ink-700" },
  running:  { label: "ランニング",   color: "bg-sage-100 text-ink-700" },
  boxing:   { label: "ボクシング",   color: "bg-sage-100 text-ink-700" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="font-maru text-2xl sm:text-3xl font-semibold text-ink-700 mb-6 tracking-wide animate-fade-up animate-delay-100">Events</h1>

        {events && events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up animate-delay-200">
            {events.map((event) => {
              const type = EVENT_TYPE_LABELS[event.event_type] ?? {
                label: event.event_type,
                color: "bg-base-100 text-ink-500",
              };
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block nm-card p-5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className={`inline-flex items-center text-xs font-maru font-medium px-3 py-1 rounded-full mb-2 ${type.color}`}>
                        {type.label}
                      </span>
                      <h2 className="font-maru font-semibold text-lg text-ink-700 leading-snug">{event.title}</h2>
                      <p className="font-maru text-sm text-ink-300 mt-1">{formatDate(event.start_at)}</p>
                      <p className="font-maru text-sm text-ink-300">{event.location}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-maru font-bold text-ink-700 text-lg">
                        {event.price === 0 ? "無料" : `¥${event.price.toLocaleString()}`}
                      </p>
                      <p className="font-maru text-xs text-ink-300 mt-1">定員 {event.capacity}名</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-ink-300">
            <p className="font-maru">現在開催予定のイベントはありません</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
