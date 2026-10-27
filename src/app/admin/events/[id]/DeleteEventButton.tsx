"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// イベントは DB から完全に削除する（2026-10-27）。これからのイベントで予約がある場合は「中止」として全員に全額返金する
export default function DeleteEventButton({
  eventId,
  phase,
  bookingCount,
}: {
  eventId: string;
  phase: "ended" | "ongoing" | "upcoming";
  bookingCount: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCancel = phase === "upcoming" && bookingCount > 0;

  function confirmMessage(): string {
    if (phase === "ended") {
      return "このイベントを削除しますか？\n\nイベントの内容（説明・場所・選択項目など）は完全に削除され、元に戻せません。参加者の参加回数・ポイント・支払いの記録は残ります。";
    }
    if (isCancel) {
      return `このイベントを中止して削除しますか？\n\n予約している${bookingCount}人全員に全額返金（使ったポイントも払い戻し）し、中止のお知らせをメールで送ります。この操作は取り消せません。`;
    }
    return "このイベントを削除しますか？\n\n予約はありません。イベントは完全に削除され、元に戻せません。";
  }

  async function handleDelete() {
    if (!confirm(confirmMessage())) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "削除に失敗しました");
      setLoading(false);
      router.refresh();
      return;
    }

    router.push("/admin/events");
    router.refresh();
  }

  if (phase === "ongoing") {
    return <p className="font-dm text-sm text-ink-300">開催中のイベントは削除できません。終了後に削除してください。</p>;
  }

  return (
    <div>
      {error && <div className="bg-red-50 text-red-600 font-dm text-sm rounded-lg px-4 py-3 mb-3">{error}</div>}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="border border-red-300 text-red-500 font-outfit font-medium px-6 py-2.5 rounded-full hover:bg-red-50 transition disabled:opacity-50"
      >
        {loading ? "処理中..." : isCancel ? `イベントを中止する（${bookingCount}人に返金）` : "イベントを削除"}
      </button>
    </div>
  );
}
