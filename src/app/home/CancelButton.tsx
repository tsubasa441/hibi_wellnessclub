"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  bookingId: string;
  refundable: boolean;
};

export default function CancelButton({ bookingId, refundable }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "キャンセルに失敗しました");
      setLoading(false);
      setConfirming(false);
      return;
    }

    router.refresh();
  }

  if (error) {
    return <p className="font-dm text-xs text-red-500">{error}</p>;
  }

  if (confirming) {
    return (
      <div className="space-y-2">
        {!refundable && (
          <p className="font-dm text-xs text-ink-500">
            イベント2日前を過ぎているため、返金はされません。
          </p>
        )}
        <div className="flex items-center gap-3">
          <p className="font-dm text-xs text-ink-500">本当にキャンセルしますか？</p>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="font-outfit text-xs font-medium text-white bg-ink-600 px-3 py-1 rounded-full disabled:opacity-60 transition hover:bg-ink-700"
          >
            {loading ? "処理中..." : "はい"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="font-outfit text-xs font-medium text-ink-500 border border-base-200 px-3 py-1 rounded-full disabled:opacity-60 transition hover:bg-base-100"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setConfirming(true)}
        className="font-outfit text-xs font-medium text-ink-300 hover:text-ink-600 transition"
      >
        キャンセルする
      </button>
      {!refundable && (
        <span className="font-dm text-xs text-ink-300">（返金なし）</span>
      )}
    </div>
  );
}
