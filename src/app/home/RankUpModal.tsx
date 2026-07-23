"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RankIcon from "@/components/RankIcon";
import type { Rank } from "@/lib/ranks";

export default function RankUpModal({ rank }: { rank: Rank }) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState(false);

  async function handleClose() {
    setDismissing(true);
    await fetch("/api/rank/notify", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-800/55 px-6">
      <div className="bg-white rounded-2xl px-8 py-10 w-full max-w-xs text-center shadow-lg">
        <p className="font-outfit text-xs font-medium tracking-[0.12em] text-ink-500 bg-sage-100 rounded-full px-4 py-1 inline-block mb-6">
          RANK UP
        </p>

        <div className="w-16 h-16 rounded-full bg-ink-700 flex items-center justify-center mx-auto mb-4 text-sage-100">
          <RankIcon level={rank.level} size={30} />
        </div>

        <p className="font-cormorant text-3xl font-semibold text-ink-700 tracking-wide">{rank.nameEn}</p>
        <p className="font-outfit text-sm text-ink-300 mt-1 mb-3">{rank.nameJa}</p>

        <p className="font-dm text-sm text-ink-500 leading-relaxed mb-8">
          {rank.minCount}回の参加を達成しました。<br />これからも続けましょう。
        </p>

        <button
          onClick={handleClose}
          disabled={dismissing}
          className="w-full nm-btn-primary text-white font-outfit font-medium py-3 disabled:opacity-40"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}
