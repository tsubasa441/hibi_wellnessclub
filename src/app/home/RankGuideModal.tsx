"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { RANKS, type Rank } from "@/lib/ranks";
import RankIcon from "@/components/RankIcon";

type Props = {
  currentLevel: number;
};

export default function RankGuideModal({ currentLevel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-dm text-xs text-white/70 underline underline-offset-2 hover:text-white transition"
      >
        ランクについて
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-outfit text-base font-semibold text-ink-700">ランク一覧</h2>
              <button onClick={() => setOpen(false)} className="text-ink-300 hover:text-ink-700 transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {RANKS.map((rank: Rank) => {
                const isCurrent = rank.level === currentLevel;
                return (
                  <div
                    key={rank.level}
                    className={`rounded-xl p-3 border ${
                      isCurrent
                        ? "border-ink-500 bg-ink-50"
                        : "border-base-200 bg-base-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <RankIcon level={rank.level} size={16} />
                      <span className="font-outfit text-sm font-semibold text-ink-700">
                        {rank.nameEn}
                      </span>
                      <span className="font-dm text-xs text-ink-300">（{rank.nameJa}）</span>
                      {isCurrent && (
                        <span className="ml-auto font-outfit text-xs font-medium text-white bg-ink-500 px-2 py-0.5 rounded-full">
                          現在
                        </span>
                      )}
                    </div>
                    <div className="font-dm text-xs text-ink-300 space-y-0.5 pl-6">
                      <p>累計参加数：{rank.minCount} 回以上</p>
                      {rank.minReferrals > 0 && (
                        <p>紹介実績：{rank.minReferrals} 人以上</p>
                      )}
                      <p>参加獲得ポイント：{rank.eventPoints} pt / 回</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
