"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EventOptionFields, { EventOption } from "./EventOptionFields";

type Event = { id: string; price: number; title: string };
type User = { id: string };
type OptionSelectionSnapshot = { option_id: string; label: string; values: string[] };
type Booking = { id: string; option_selections?: OptionSelectionSnapshot[] | null } | null;

export default function BookingButton({
  event,
  user,
  userBooking,
  isSoldOut,
  options = [],
}: {
  event: Event;
  user: User;
  userBooking: Booking;
  isSoldOut: boolean;
  options?: EventOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [selections, setSelections] = useState<Record<string, string[]>>({});

  const missingRequired = useMemo(
    () => options.some((o) => o.required && (selections[o.id]?.length ?? 0) === 0),
    [options, selections]
  );

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
    const answered = (userBooking.option_selections ?? []).filter((s) => s.values.length > 0);
    return (
      <div className="space-y-3">
        <div className="bg-sage-100 border border-sage-200 rounded-xl p-4 text-center">
          <p className="font-maru font-semibold text-ink-700">予約済みです</p>
          <p className="font-maru text-sm text-ink-500 mt-1">このイベントへの参加が確定しています。</p>
        </div>
        {answered.length > 0 && (
          <div className="bg-base-100 rounded-xl p-4">
            <p className="font-maru text-xs text-ink-400 mb-1">選択内容</p>
            {answered.map((s) => (
              <p key={s.option_id} className="font-maru text-sm font-medium text-ink-700">
                {s.label}：{s.values.join("、")}
              </p>
            ))}
          </div>
        )}
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

  function buildOptionPayload() {
    return options.map((o) => ({ optionId: o.id, values: selections[o.id] ?? [] }));
  }

  async function handleFreeBooking() {
    if (missingRequired) {
      setError("必須の選択項目を選んでください");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/payments/square", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id, sourceId: "FREE", optionSelections: buildOptionPayload() }),
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

  function handleGoToCheckout() {
    if (missingRequired) {
      setError("必須の選択項目を選んでください");
      return;
    }
    const query = new URLSearchParams({ opts: JSON.stringify(buildOptionPayload()) });
    router.push(`/events/${event.id}/checkout?${query.toString()}`);
  }

  return (
    <div className="space-y-3">
      {options.length > 0 && (
        <EventOptionFields options={options} value={selections} onChange={setSelections} />
      )}
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
        <button
          onClick={handleGoToCheckout}
          className="w-full text-center bg-sage-500 text-white font-maru font-medium py-3 rounded-full hover:bg-sage-600 transition"
        >
          予約する
        </button>
      )}
    </div>
  );
}
