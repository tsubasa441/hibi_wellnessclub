import Image from "next/image";

// 画面遷移・処理待ちの間に全画面で出す読み込み画面（loading.tsx から使う。2026-10-24、依頼者の指定で読み込み中の枠から置き換え）。
// ぼかした色の層がゆっくり流れる背景に、区切りのある輪が回り、中央に白いロゴ。
// すぐ終わる遷移でちらつかないよう、少し遅れてから現れる
export default function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] overflow-hidden bg-sage-400 flex items-center justify-center animate-loading-in"
    >
      <span className="sr-only">読み込み中</span>

      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute -top-1/4 -left-1/4 w-[70vmax] h-[70vmax] rounded-full bg-sage-50 opacity-50 blur-3xl animate-loading-drift motion-reduce:animate-none" />
        <div className="absolute top-1/4 -right-1/3 w-[65vmax] h-[65vmax] rounded-full bg-base-100 opacity-35 blur-3xl animate-loading-drift-reverse motion-reduce:animate-none" />
        <div className="absolute -bottom-1/3 -left-1/5 w-[60vmax] h-[60vmax] rounded-full bg-sage-500 opacity-60 blur-3xl animate-loading-drift-reverse motion-reduce:animate-none" />
        <div className="absolute -bottom-1/4 right-0 w-[45vmax] h-[45vmax] rounded-full bg-ink-400 opacity-40 blur-3xl animate-loading-drift motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-ink-800/10" />
      </div>

      <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
        <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 w-full h-full animate-loading-spin motion-reduce:animate-none">
          <circle cx="50" cy="50" r="47" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="66.8 7" strokeDashoffset="3.5" />
        </svg>
        <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 w-full h-full animate-loading-spin-reverse motion-reduce:animate-none">
          <circle cx="50" cy="50" r="41" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="0.6" strokeDasharray="1 4" />
        </svg>
        <div className="flex flex-col items-center animate-loading-breathe motion-reduce:animate-none">
          <Image src="/images/hibi-logo-white.png" alt="" width={540} height={236} priority className="h-8 sm:h-9 w-auto" />
          <span className="font-dm text-[11px] sm:text-xs text-white/90 tracking-[0.1em] mt-1">wellness club</span>
        </div>
      </div>
    </div>
  );
}
