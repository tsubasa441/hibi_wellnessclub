import { RANKS, type Rank } from "@/lib/ranks";
import RankIcon from "@/components/RankIcon";

// ランク一覧（条件・参加ポイント）。"cards" は「ランクについて」のモーダル用、
// "rows" はホームのメンバーカードの下に開く角丸なしの一覧用
export default function RankList({ currentLevel, variant = "cards" }: { currentLevel: number; variant?: "cards" | "rows" }) {
  return (
    <div className={variant === "cards" ? "space-y-3" : "divide-y divide-base-200"}>
      {RANKS.map((rank: Rank) => {
        const isCurrent = rank.level === currentLevel;
        const itemClass =
          variant === "cards"
            ? `rounded-xl p-3 border ${isCurrent ? "border-ink-500 bg-ink-50" : "border-base-200 bg-base-50"}`
            : `px-4 py-3 sm:px-5 ${isCurrent ? "bg-ink-50" : ""}`;
        return (
          <div key={rank.level} className={itemClass}>
            <div className="flex items-center gap-2 mb-1">
              <RankIcon level={rank.level} size={16} />
              <span className="font-outfit text-sm font-semibold text-ink-700">{rank.nameEn}</span>
              <span className="font-dm text-xs text-ink-300">（{rank.nameJa}）</span>
              {isCurrent && (
                <span className="ml-auto font-outfit text-xs font-medium text-white bg-ink-500 px-2 py-0.5 rounded-full">
                  現在
                </span>
              )}
            </div>
            <div className="font-dm text-xs text-ink-300 space-y-0.5 pl-6">
              <p>累計参加数：{rank.minCount} 回以上</p>
              {rank.minReferrals > 0 && <p>紹介実績：{rank.minReferrals} 人以上</p>}
              <p>参加獲得ポイント：{rank.eventPoints} pt / 回</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
