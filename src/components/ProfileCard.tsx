"use client";

import { useState } from "react";
import RankIcon from "@/components/RankIcon";
import RankList from "@/components/RankList";
import type { Rank } from "@/lib/ranks";

type Props = {
  // "home": Member since + 名前 / "impact": 現在のランク ラベル
  variant?: "home" | "impact";
  memberSince?: string;
  displayName?: string;
  sessionCount: number;
  points: number;
  currentRank: Rank;
  nextRank: Rank | null;
  countToNext: number | null;
  className?: string;
};

export default function ProfileCard({
  variant = "home",
  memberSince,
  displayName,
  sessionCount,
  points,
  currentRank,
  nextRank,
  countToNext,
  className = "",
}: Props) {
  // 「ランクについて」はモーダルではなく、カードの下にランク一覧を開く（2026-10-24、依頼者の指定）
  const [rankGuideOpen, setRankGuideOpen] = useState(false);

  return (
    <div className={className}>
    <div className="bg-white text-ink-700 -mx-4 sm:mx-0 p-4 sm:px-5">
      {variant === "home" ? (
        // ランクは右側の余白に大きく出す（2026-10-25、依頼者の指定。以前は右上に小さく表示）
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-dm text-xs text-ink-300">Member since {memberSince}</p>
            <p className="font-outfit text-xl font-semibold tracking-wide mt-2 truncate">{displayName}</p>
            <Stats sessionCount={sessionCount} points={points} />
          </div>
          <div className="shrink-0 flex items-center gap-2 text-sage-600 pr-1">
            <RankIcon level={currentRank.level} size={36} />
            <div className="text-center">
              <p className="font-outfit text-xl font-bold leading-tight">{currentRank.nameEn}</p>
              <p className="font-outfit text-xs text-sage-600/70">{currentRank.nameJa}</p>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-dm text-xs text-ink-300">現在のランク</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-sage-600">
            <RankIcon level={currentRank.level} size={16} />
            <p className="font-outfit text-lg font-bold leading-tight">{currentRank.nameEn}</p>
            <p className="font-outfit text-xs text-sage-600/70">（{currentRank.nameJa}）</p>
          </div>
          <Stats sessionCount={sessionCount} points={points} />
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        {nextRank && countToNext !== null && countToNext > 0 ? (
          <p className="font-dm text-xs text-ink-300">
            次のランク <span className="font-outfit font-semibold text-sage-600">{nextRank.nameEn}</span> まであと <span className="font-semibold text-sage-600">{countToNext} 回</span>
          </p>
        ) : (
          <p className="font-dm text-xs text-ink-300">最高ランク到達</p>
        )}
        <button
          onClick={() => setRankGuideOpen((v) => !v)}
          aria-expanded={rankGuideOpen}
          aria-controls="rank-guide-list"
          className="font-dm text-xs text-sage-600 underline underline-offset-2 hover:text-sage-500 transition"
        >
          {rankGuideOpen ? "ランク一覧を閉じる" : "ランクについて"}
        </button>
      </div>
    </div>
    {rankGuideOpen && (
      <section id="rank-guide-list" aria-label="ランク一覧" className="bg-white -mx-4 sm:mx-0 mt-2">
        <RankList currentLevel={currentRank.level} variant="rows" />
      </section>
    )}
    </div>
  );
}

function Stats({ sessionCount, points }: { sessionCount: number; points: number }) {
  return (
    <div className="flex items-center gap-6 mt-3">
      <div>
        <p className="font-bebas text-4xl leading-none text-sage-600">{sessionCount}</p>
        <p className="font-dm text-xs text-ink-300 mt-0.5">累計参加数</p>
      </div>
      <div className="w-px h-8 bg-ink-200" />
      <div>
        <p className="font-bebas text-4xl leading-none text-sage-600">{points}</p>
        <p className="font-dm text-xs text-ink-300 mt-0.5">Points</p>
      </div>
    </div>
  );
}
