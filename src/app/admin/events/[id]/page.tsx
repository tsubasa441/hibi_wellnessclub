import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "../EventForm";
import DeleteEventButton from "./DeleteEventButton";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const [{ data: event }, { data: options }, { count: bookingCount }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single(),
    supabase
      .from("event_options")
      .select("id, label, choices, multi_select, required, sort_order")
      .eq("event_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("event_id", id).eq("status", "confirmed"),
  ]);

  if (!event) notFound();

  // 削除ボタンの確認文を、終了済み・開催中・これから（＝中止して返金）で出し分ける
  // eslint-disable-next-line react-hooks/purity -- Server Component のためリクエストごとに1回だけ評価される
  const now = Date.now();
  const start = new Date(event.start_at).getTime();
  const end = event.end_at ? new Date(event.end_at).getTime() : start + 2 * 60 * 60 * 1000;
  const phase = end <= now ? "ended" : start <= now ? "ongoing" : "upcoming";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-ink-700">イベントを編集</h1>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/admin/events/${event.id}/participants`}
            className="font-outfit text-xs text-sage-500 hover:text-sage-600 transition"
          >
            参加者一覧を見る
          </Link>
          <Link href="/admin/events" className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition">
            イベント一覧へ戻る
          </Link>
        </div>
      </div>

      <EventForm mode="edit" initialEvent={event} initialOptions={options ?? []} />

      <div className="mt-8 pt-6 border-t border-base-200">
        <DeleteEventButton eventId={event.id} phase={phase} bookingCount={bookingCount ?? 0} />
      </div>
    </div>
  );
}
