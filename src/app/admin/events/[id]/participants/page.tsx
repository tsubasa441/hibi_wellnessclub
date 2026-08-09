import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/encrypt";

const PAYMENT_LABELS: Record<string, string> = { square: "Square", paypay: "PayPay", free: "無料" };
const STATUS_LABELS: Record<string, string> = { pending: "未払い", paid: "支払済み", refunded: "返金済み" };

type BookingRow = {
  id: string;
  payment_method: string | null;
  payment_status: string;
  points_used: number | null;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

export default async function EventParticipantsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, title, capacity")
    .eq("id", params.id)
    .single();

  if (!event) notFound();

  const { data } = await supabase
    .from("bookings")
    .select("id, payment_method, payment_status, points_used, created_at, profiles(name)")
    .eq("event_id", params.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  const bookings = (data ?? []) as unknown as BookingRow[];

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-cormorant text-2xl font-semibold text-ink-700">{event.title}</h1>
          <p className="font-dm text-sm text-ink-300 mt-1">
            参加者 {bookings.length} / 定員 {event.capacity}名
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <a
            href={`/api/admin/events/${event.id}/participants/export`}
            className="bg-sage-500 text-white font-outfit text-xs font-medium px-4 py-2 rounded-full hover:bg-sage-600 transition"
          >
            CSVダウンロード
          </a>
          <Link href={`/admin/events/${event.id}`} className="font-outfit text-xs text-ink-300 hover:text-ink-700 transition">
            イベント編集へ戻る
          </Link>
        </div>
      </div>

      {bookings.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(44,53,49,0.08)] overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-200">
                <th className="font-outfit text-xs text-ink-300 font-medium px-4 py-3">氏名</th>
                <th className="font-outfit text-xs text-ink-300 font-medium px-4 py-3">決済方法</th>
                <th className="font-outfit text-xs text-ink-300 font-medium px-4 py-3">決済状況</th>
                <th className="font-outfit text-xs text-ink-300 font-medium px-4 py-3">使用ポイント</th>
                <th className="font-outfit text-xs text-ink-300 font-medium px-4 py-3">予約日時</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
                return (
                  <tr key={b.id} className="border-b border-base-100 last:border-0">
                    <td className="font-dm text-sm text-ink-700 px-4 py-3">
                      {profile?.name ? decrypt(profile.name) : "-"}
                    </td>
                    <td className="font-dm text-sm text-ink-500 px-4 py-3">
                      {PAYMENT_LABELS[b.payment_method ?? ""] ?? b.payment_method ?? "-"}
                    </td>
                    <td className="font-dm text-sm text-ink-500 px-4 py-3">
                      {STATUS_LABELS[b.payment_status] ?? b.payment_status}
                    </td>
                    <td className="font-dm text-sm text-ink-500 px-4 py-3">{b.points_used ?? 0}pt</td>
                    <td className="font-dm text-sm text-ink-300 px-4 py-3">
                      {new Date(b.created_at).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 text-ink-300">
          <p className="font-dm text-sm">参加者はまだいません</p>
        </div>
      )}
    </div>
  );
}
