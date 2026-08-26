export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const EVENT_TYPE_LABELS: Record<string, string> = {
  yoga: "ヨガ",
  training: "トレーニング",
  running: "ランニング",
  boxing: "ボクシング",
  pilates: "ピラティス",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "下書き", color: "bg-base-200 text-ink-500" },
  published: { label: "公開中", color: "bg-sage-100 text-sage-600" },
  cancelled: { label: "削除済み", color: "bg-red-50 text-red-500" },
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminEventsPage() {
  const supabase = createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .neq("status", "cancelled")
    .order("start_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-cormorant text-2xl font-semibold text-ink-700">イベント管理</h1>
        <Link
          href="/admin/events/new"
          className="bg-sage-500 text-white font-outfit text-sm font-medium px-5 py-2.5 rounded-full hover:bg-sage-600 transition"
        >
          新規作成
        </Link>
      </div>

      {events && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => {
            const status = STATUS_LABELS[event.status] ?? { label: event.status, color: "bg-base-100 text-ink-500" };
            return (
              <div key={event.id} className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(44,53,49,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center text-xs font-outfit font-medium px-3 py-1 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="font-outfit text-xs text-ink-300">
                        {EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}
                      </span>
                    </div>
                    <h2 className="font-outfit font-semibold text-ink-700">{event.title}</h2>
                    <p className="font-dm text-sm text-ink-300 mt-1">{formatDate(event.start_at)}</p>
                    <p className="font-dm text-sm text-ink-300">{event.location} ／ 定員{event.capacity}名 ／ {event.price === 0 ? "無料" : `¥${event.price.toLocaleString()}`}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="font-outfit text-xs text-sage-500 hover:text-sage-600 transition"
                    >
                      編集
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}/participants`}
                      className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition"
                    >
                      参加者
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-ink-300">
          <p className="font-dm text-sm">イベントがありません</p>
        </div>
      )}
    </div>
  );
}
