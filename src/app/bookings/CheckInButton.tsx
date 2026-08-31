"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function eventEnd(startAt: string, endAt: string | null): number {
  if (endAt) return new Date(endAt).getTime();
  return new Date(startAt).getTime() + 2 * 60 * 60 * 1000;
}

export default function CheckInButton({
  bookingId,
  startAt,
  endAt,
  checkedInAt,
}: {
  bookingId: string;
  startAt: string;
  endAt: string | null;
  checkedInAt: string | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (checkedInAt) {
    return (
      <div className="flex items-center gap-1.5 text-sage-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-outfit text-xs font-medium">チェックイン済み</span>
      </div>
    );
  }

  const start = new Date(startAt).getTime();
  const end = eventEnd(startAt, endAt);
  const beforeStart = now < start;
  const afterEnd = now > end;
  const active = !beforeStart && !afterEnd;

  async function handleCheckIn() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/checkin`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "チェックインに失敗しました");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1.5">
      {error && (
        <p className="font-dm text-xs text-red-500">{error}</p>
      )}
      <button
        onClick={handleCheckIn}
        disabled={!active || loading}
        className={
          active
            ? "font-outfit text-xs font-medium text-white bg-sage-500 px-5 py-2 rounded-full hover:bg-sage-600 transition disabled:opacity-60"
            : "font-outfit text-xs font-medium text-ink-300 bg-base-200 px-5 py-2 rounded-full cursor-not-allowed"
        }
      >
        {loading ? "処理中..." : afterEnd ? "受付終了" : "チェックイン"}
      </button>
      {beforeStart && (
        <p className="font-dm text-xs text-ink-300">開始時刻になるとチェックインできます</p>
      )}
    </div>
  );
}
