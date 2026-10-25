"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import EventOptionFields, { EventOption } from "./EventOptionFields";
import Toast from "@/components/Toast";

type Event = { id: string; price: number; title: string };
type User = { id: string };
type OptionSelectionSnapshot = { option_id: string; label: string; values: string[] };
type Booking = { id: string; option_selections?: OptionSelectionSnapshot[] | null } | null;

export default function BookingButton({
  event,
  user,
  userBooking,
  isSoldOut,
  isWaitlisted = false,
  options = [],
}: {
  event: Event;
  user: User;
  userBooking: Booking;
  isSoldOut: boolean;
  isWaitlisted?: boolean;
  options?: EventOption[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 上記の理由で、prop の切り替わりを契機にリセットする
    setLoading(false);
    setCancelLoading(false);
    setCancelled(false);
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
    setCancelled(true);
    // サーバーから最新の userBooking が届くまでボタンを無効化したまま待ち、
    // 反映前に「予約する」ボタンへ切り替わって誤タップされるのを防ぐ。
    // アナウンスを見せてから refresh する
    setTimeout(() => router.refresh(), 2000);
  }

  if (cancelled) {
    return <Toast message="ご予約をキャンセルしました。" />;
  }

  if (userBooking) {
    const answered = (userBooking.option_selections ?? []).filter((s) => s.values.length > 0);
    return (
      <div className="space-y-3">
        <div className="bg-sage-100 border border-sage-200 p-4 text-center">
          <p className="font-noto font-semibold text-ink-700">予約済みです</p>
          <p className="font-noto text-sm text-ink-500 mt-1">このイベントへの参加が確定しています。</p>
        </div>
        {answered.length > 0 && (
          <div className="bg-base-100 p-4">
            <p className="font-noto text-xs text-ink-400 mb-1">選択内容</p>
            {answered.map((s) => (
              <p key={s.option_id} className="font-noto text-sm font-medium text-ink-700">
                {s.label}：{s.values.join("、")}
              </p>
            ))}
          </div>
        )}
        {cancelError && (
          <div className="bg-red-50 text-red-600 font-noto text-sm px-4 py-3">{cancelError}</div>
        )}
        <button
          onClick={handleCancel}
          disabled={cancelLoading}
          className="w-full border border-ink-300 text-ink-500 font-noto font-medium py-3 rounded-md hover:bg-base-100 transition disabled:opacity-60"
        >
          {cancelLoading ? "キャンセル中..." : "予約をキャンセルする"}
        </button>
      </div>
    );
  }

  if (isSoldOut) {
    return (
      <div className="space-y-3">
        <button disabled className="w-full bg-base-200 text-ink-300 font-noto font-medium py-3 rounded-md cursor-not-allowed">
          満席
        </button>
        <WaitlistButton eventId={event.id} isSoldOut isWaitlisted={isWaitlisted} />
      </div>
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
        <div className="bg-red-50 text-red-600 font-noto text-sm px-4 py-3">{error}</div>
      )}
      {event.price === 0 ? (
        <button
          onClick={handleFreeBooking}
          disabled={loading}
          className="w-full bg-ink-500 text-white font-noto font-medium py-3 rounded-md hover:bg-base-200 hover:text-ink-700 transition disabled:opacity-60"
        >
          {loading ? "予約中..." : "予約する"}
        </button>
      ) : (
        <button
          onClick={handleGoToCheckout}
          className="w-full text-center bg-ink-500 text-white font-noto font-medium py-3 rounded-md hover:bg-base-200 hover:text-ink-700 transition"
        >
          予約する
        </button>
      )}
      <WaitlistButton eventId={event.id} isSoldOut={false} isWaitlisted={isWaitlisted} />
    </div>
  );
}

// キャンセル待ち（2026-10-25）。満席のときだけ押せる。登録すると、空きが出たときにメールで知らせる
function WaitlistButton({ eventId, isSoldOut, isWaitlisted }: { eventId: string; isSoldOut: boolean; isWaitlisted: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // サーバーの最新の状態が届いたら、押せる状態に戻す
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 登録・取り消しの反映を契機にリセットする
    setLoading(false);
  }, [isWaitlisted, isSoldOut]);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/waitlist`, { method: isWaitlisted ? "DELETE" : "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "処理に失敗しました");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  if (isSoldOut && isWaitlisted) {
    return (
      <div className="space-y-2">
        <p className="font-noto text-sm text-ink-500 text-center">キャンセル待ち中です。空きが出たらメールでお知らせします。</p>
        {error && <div className="bg-red-50 text-red-600 font-noto text-sm px-4 py-3">{error}</div>}
        <button
          onClick={handleClick}
          disabled={loading}
          className="w-full border border-ink-300 text-ink-500 font-noto font-medium py-3 rounded-md hover:bg-base-100 transition disabled:opacity-60"
        >
          {loading ? "処理中..." : "キャンセル待ちを取り消す"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <div className="bg-red-50 text-red-600 font-noto text-sm px-4 py-3">{error}</div>}
      <button
        onClick={handleClick}
        disabled={!isSoldOut || loading}
        className={`w-full font-noto font-medium py-3 rounded-md transition ${
          isSoldOut
            ? "border border-ink-500 text-ink-700 hover:bg-base-200 disabled:opacity-60"
            : "border border-base-200 text-ink-300 cursor-not-allowed"
        }`}
      >
        {loading ? "処理中..." : "キャンセル待ちをする"}
      </button>
    </div>
  );
}
