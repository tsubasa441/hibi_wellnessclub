"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEventButton({
  eventId,
  disabled,
}: {
  eventId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("このイベントを削除しますか？参加者の予約情報は保持されます（キャンセル扱いになります）。")) {
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "削除に失敗しました");
      setLoading(false);
      return;
    }

    router.push("/admin/events");
    router.refresh();
  }

  return (
    <div>
      {error && <div className="bg-red-50 text-red-600 font-dm text-sm rounded-lg px-4 py-3 mb-3">{error}</div>}
      <button
        onClick={handleDelete}
        disabled={disabled || loading}
        className="border border-red-300 text-red-500 font-outfit font-medium px-6 py-2.5 rounded-full hover:bg-red-50 transition disabled:opacity-50"
      >
        {loading ? "削除中..." : disabled ? "削除済み" : "イベントを削除"}
      </button>
    </div>
  );
}
