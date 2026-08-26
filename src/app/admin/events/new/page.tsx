import Link from "next/link";
import EventForm from "../EventForm";

export default function NewEventPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-ink-700">イベントを作成</h1>
        <Link href="/admin/events" className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition">
          イベント一覧へ戻る
        </Link>
      </div>
      <EventForm mode="create" />
    </div>
  );
}
