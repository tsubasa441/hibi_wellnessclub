const SIZE = 160;
const CENTER = SIZE / 2;
const RING_RADII = [26, 48, 70];
const MAX_DOTS = 12;

// 「あなたから広がった幸せ」を波紋で描く。中心があなた、点が広がった人（多いときは12個まで）
export default function ReachRipple({ count }: { count: number }) {
  const dots = Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => {
    // 内側の輪に6人、外側の輪にその先を置く
    const onInner = i < 6;
    const r = onInner ? RING_RADII[1] : RING_RADII[2];
    const slots = onInner ? 6 : MAX_DOTS - 6;
    const index = onInner ? i : i - 6;
    const angle = (index / slots) * Math.PI * 2 - Math.PI / 2 + (onInner ? 0 : Math.PI / slots);
    return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle), r: onInner ? 7 : 5.5 };
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-24 h-24 sm:w-36 sm:h-36 shrink-0" role="img" aria-label={`あなたから広がった人 ${count}人`}>
      {RING_RADII.map((r, i) => (
        <circle
          key={r}
          cx={CENTER}
          cy={CENTER}
          r={r}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray={i === 0 ? undefined : "3 5"}
          className="stroke-sage-100"
        />
      ))}
      <circle cx={CENTER} cy={CENTER} r={14} className="fill-sage-600" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} className="fill-sage-300" />
      ))}
    </svg>
  );
}
