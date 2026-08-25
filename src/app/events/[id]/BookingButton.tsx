"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Event = { id: string; price: number; title: string };
type User = { id: string };
type Booking = { id: string } | null;

export default function BookingButton({
  event,
  user,
  userBooking,
  isSoldOut,
}: {
  event: Event;
  user: User;
  userBooking: Booking;
  isSoldOut: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // userBooking がサーバーの最新データに切り替わったタイミングでのみ
  // loading/cancelLoading をリセットする。fetch 直後に即リセットすると、
  // router.refresh() の反映が届く前に一瞬ボタンが再度押せる状態になり、
  // 二重予約・二重キャンセルにつながるため（BUG-5と同種の懸念）。
  useEffect(() => {
    setLoading(false);
    setCancelLoading(false);
  }, [userBooking]);

  async function handleCancel() {
    if (!userBooking) return;
    if (!confirm("予約をキャンセルしますか？決済済みの場合は返金されます。")) return;
    setCancelLoading(true);
    setCancelError(null);
    const res = await fetch(`/api/bookings/${userBooking.id}/cancel`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setCancelError(json.error ?? "キャンセルに失敗しました");
      setCancelLoading(false);
      return;
    }
    // サーバーから最新の userBooking が届くまでボタンを無効化したまま待ち、
    // 反映前に「予約する」ボタンへ切り替わって誤タップされるのを防ぐ
    router.refresh();
  }

  if (userBooking) {
    return (
      <div className="space-y-3">
        <div className="bg-sage-100 border border-sage-200 rounded-xl p-4 text-center">
          <p className="font-maru font-semibold text-ink-700">予約済みです</p>
          <p className="font-maru text-sm text-ink-500 mt-1">このイベントへの参加が確定しています。</p>
        </div>
        {cancelError && (
          <div className="bg-red-50 text-red-600 font-maru text-sm rounded-lg px-4 py-3">{cancelError}</div>
        )}
        <button
          onClick={handleCancel}
          disabled={cancelLoading}
          className="w-full border border-ink-300 text-ink-500 font-maru font-medium py-3 rounded-full hover:bg-base-100 transition disabled:opacity-60"
        >
          {cancelLoading ? "キャンセル中..." : "予約をキャンセルする"}
        </button>
      </div>
    );
  }

  if (isSoldOut) {
    return (
      <button disabled className="w-full bg-base-200 text-ink-300 font-maru font-medium py-3 rounded-full cursor-not-allowed">
        満席
      </button>
    );
  }

  async function handleFreeBooking() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/square", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, sourceId: "FREE" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "予約に失敗しました。もう一度お試しください。");
      setLoading(false);
    } else {
      // サーバーから最新の userBooking が届くまでボタンを無効化したまま待つ
      // （届いた時点で上の useEffect が loading をリセットする）
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 text-red-600 font-maru text-sm rounded-lg px-4 py-3">{error}</div>
      )}
      {event.price === 0 ? (
        <button
          onClick={handleFreeBooking}
          disabled={loading}
          className="w-full bg-sage-500 text-white font-maru font-medium py-3 rounded-full hover:bg-sage-600 transition disabled:opacity-60"
        >
          {loading ? "予約中..." : "予約する"}
        </button>
      ) : (
        <Link
          href={`/events/${event.id}/checkout`}
          className="block w-full text-center bg-sage-500 text-white font-maru font-medium py-3 rounded-full hover:bg-sage-600 transition"
        >
          予約する
        </Link>
      )}
    </div>
  );
}
