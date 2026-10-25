"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHECKIN_OPENS_BEFORE_MINUTES, getCheckinWindow } from "@/lib/checkinWindow";

export default function CheckInButton({
  bookingId,
  startAt,
  checkedInAt,
  size = "md",
}: {
  bookingId: string;
  startAt: string;
  // 受付時間は開始時刻だけで決まる（開始30分前〜開始15分後）。呼び出し側の互換のため残している
  endAt?: string | null;
  checkedInAt: string | null;
  // "lg" はチェックイン画面（/checkin）用の横幅いっぱいの大きなボタン
  size?: "md" | "lg";
}) {
  const lg = size === "lg";
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
      <div className={`flex items-center gap-1.5 text-sage-600 ${lg ? "justify-center py-4" : ""}`}>
        <svg width={lg ? 22 : 16} height={lg ? 22 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className={`font-outfit font-medium ${lg ? "text-base" : "text-xs"}`}>チェックイン済み</span>
      </div>
    );
  }

  const { opensAt, closesAt } = getCheckinWindow(startAt);
  const beforeStart = now < opensAt;
  const afterEnd = now > closesAt;
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
    <div className={lg ? "space-y-2 text-center" : "space-y-1.5"}>
      {error && (
        <p className="font-dm text-xs text-red-500">{error}</p>
      )}
      <button
        onClick={handleCheckIn}
        disabled={!active || loading}
        className={`font-outfit font-medium rounded-full ${lg ? "w-full text-base py-4" : "text-xs px-5 py-2"} ${
          active
            ? "text-white bg-sage-500 hover:bg-sage-600 transition disabled:opacity-60"
            : "text-ink-300 bg-base-200 cursor-not-allowed"
        }`}
      >
        {loading ? "処理中..." : afterEnd ? "受付終了" : "チェックイン"}
      </button>
      {beforeStart && (
        <p className="font-dm text-xs text-ink-300">開始{CHECKIN_OPENS_BEFORE_MINUTES}分前からチェックインできます</p>
      )}
    </div>
  );
}
