"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import RankList from "@/components/RankList";

type Props = {
  currentLevel: number;
  // 濃い背景の上に置くとき用（インパクト画面の年輪カード）
  triggerClassName?: string;
};

export default function RankGuideModal({ currentLevel, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "font-dm text-xs text-sage-600 underline underline-offset-2 hover:text-sage-500 transition"}
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

            <RankList currentLevel={currentLevel} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
