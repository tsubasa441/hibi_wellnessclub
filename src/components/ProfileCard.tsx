import RankIcon from "@/components/RankIcon";
import RankGuideModal from "@/components/RankGuideModal";
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
  return (
    <div className={`bg-white text-ink-700 rounded-[20px] p-4 shadow-[0_1px_4px_rgba(44,53,49,0.08)] ${className}`}>
      {variant === "home" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="font-dm text-xs text-ink-300">Member since {memberSince}</p>
            <div className="flex items-center gap-1 text-sage-600">
              <RankIcon level={currentRank.level} size={14} />
              <p className="font-outfit text-sm font-bold leading-tight">{currentRank.nameEn}</p>
              <p className="font-outfit text-xs text-sage-600/70">（{currentRank.nameJa}）</p>
            </div>
          </div>
          <p className="font-outfit text-xl font-semibold tracking-wide mt-2 truncate">{displayName}</p>
        </>
      ) : (
        <div>
          <p className="font-dm text-xs text-ink-300">現在のランク</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-sage-600">
            <RankIcon level={currentRank.level} size={16} />
            <p className="font-outfit text-lg font-bold leading-tight">{currentRank.nameEn}</p>
            <p className="font-outfit text-xs text-sage-600/70">（{currentRank.nameJa}）</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6 mt-3">
        <div>
          <p className="font-outfit text-2xl font-bold text-sage-600">{sessionCount}</p>
          <p className="font-dm text-xs text-ink-300 mt-0.5">累計参加数</p>
        </div>
        <div className="w-px h-8 bg-ink-200" />
        <div>
          <p className="font-outfit text-2xl font-bold text-sage-600">{points}</p>
          <p className="font-dm text-xs text-ink-300 mt-0.5">Points</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        {nextRank && countToNext !== null && countToNext > 0 ? (
          <p className="font-dm text-xs text-ink-300">
            次のランク <span className="font-outfit font-semibold text-sage-600">{nextRank.nameEn}</span> まであと <span className="font-semibold text-sage-600">{countToNext} 回</span>
          </p>
        ) : (
          <p className="font-dm text-xs text-ink-300">最高ランク到達</p>
        )}
        <RankGuideModal currentLevel={currentRank.level} />
      </div>
    </div>
  );
}
