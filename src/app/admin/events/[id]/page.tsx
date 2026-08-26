import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventForm from "../EventForm";
import DeleteEventButton from "./DeleteEventButton";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!event) notFound();

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

      <EventForm mode="edit" initialEvent={event} />

      <div className="mt-8 pt-6 border-t border-base-200">
        <DeleteEventButton eventId={event.id} disabled={event.status === "cancelled"} />
      </div>
    </div>
  );
}
