import { RANKS } from "@/lib/ranks";
import RankIcon from "@/components/RankIcon";

const SIZE = 240;
const CENTER = SIZE / 2;
const INNER_RADIUS = 34;
const RING_GAP = 10.5;

// ランク（種→大樹）を年輪に見立てる。内側から1本ずつランクに対応し、
// 到達したランクの輪は塗り、次のランクの輪は進み具合の分だけ白い弧で描く
export default function GrowthRings({ level, progress }: { level: number; progress: number }) {
  const rings = RANKS.map((rank, i) => {
    const r = INNER_RADIUS + i * RING_GAP;
    return { level: rank.level, r, circumference: 2 * Math.PI * r };
  });
  const nextRing = rings.find((ring) => ring.level === level + 1);

  return (
    <div className="relative w-[112px] h-[112px] sm:w-[180px] sm:h-[180px] shrink-0">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full" role="img" aria-label={`全${RANKS.length}段階のうち${level}段階目`}>
        {rings.map((ring) => {
          const reached = ring.level <= level;
          return (
            <circle
              key={ring.level}
              cx={CENTER}
              cy={CENTER}
              r={ring.r}
              fill="none"
              strokeWidth={reached ? 4 : 1.5}
              strokeDasharray={reached ? undefined : "2 5"}
              className={reached ? "stroke-sage-50" : "stroke-white/25"}
            />
          );
        })}
        {nextRing && progress > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={nextRing.r}
            fill="none"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${nextRing.circumference * Math.min(progress, 1)} ${nextRing.circumference}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            className="stroke-white"
          />
        )}
        <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 8} className="fill-white" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sage-600" aria-hidden="true">
        <RankIcon level={level} size={26} />
      </div>
    </div>
  );
}
