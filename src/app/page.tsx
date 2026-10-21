import Link from "next/link";
import Image from "next/image";
import Footer from "@/components/Footer";
import HeroBackground, { type HeroSlide } from "./HeroBackground";
import ProgramCarousel from "./ProgramCarousel";
import AccountDeletedToast from "./AccountDeletedToast";

// 動画・写真を追加すると自動でクロスフェード表示される
// （例: { type: "video", src: "/videos/yoga.mp4" }）。1件のみの場合は
// 切り替わらず、動画ならそのままループ再生され続ける
const HERO_SLIDES: HeroSlide[] = [
  { type: "video", src: "/videos/hibi-top.mp4", poster: "/images/hibi-top-poster.jpg" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ accountDeleted?: string }>;
}) {
  const accountDeleted = (await searchParams).accountDeleted === "1";

  return (
    // 背景はヘッダー・フッターと同じ nav-bg（依頼者の指定、2026-10-12）
    <div className="bg-nav-bg min-h-svh">
    <main className="min-h-[calc(100svh+1.5rem)] px-4 sm:px-6 pb-16">
      {accountDeleted && <AccountDeletedToast />}

      <div className="text-center pt-6 pb-6 sm:pt-8 sm:pb-8 animate-fade-up">
        {/* ロゴ画像は public/images/hibi_logo.jpg から文字だけを透過 PNG に切り出したもの（2026-10-21、依頼者の指定） */}
        <h1 className="flex justify-center">
          <Image src="/images/hibi-logo.png" alt="Hibi" width={540} height={236} priority className="h-10 sm:h-12 w-auto" />
        </h1>
        <p className="font-dm text-xs sm:text-sm text-ink-500 tracking-[0.1em] mt-1">wellness club</p>
      </div>

      <section className="relative mx-auto max-w-5xl h-[30svh] sm:h-[38svh] min-h-[220px] max-h-[380px] rounded-2xl overflow-hidden">
        <HeroBackground slides={HERO_SLIDES} />
        <div className="absolute inset-0 bg-black/30" />

        {/* 見出しは残りの高さの中央、ボタンは動画枠の下端から一定の位置に置く（依頼者の指定、2026-10-21） */}
        <div className="relative z-10 h-full flex flex-col items-center px-6 pb-6 sm:pb-10 text-center">
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="font-bebas text-[30px] sm:text-[52px] text-white leading-none tracking-[0.04em] uppercase drop-shadow-lg animate-fade-up animate-delay-200">
              The city is your studio.
            </p>
            <p className="-mt-1 font-zenkaku text-xs sm:text-sm text-white/90 tracking-[0.15em] whitespace-nowrap drop-shadow animate-fade-up animate-delay-300">
              この街ごと、スタジオに変える
            </p>
          </div>
          <Link
            href="/login"
            className="shrink-0 inline-flex items-center gap-2 whitespace-nowrap bg-white/95 text-ink-700 font-outfit font-semibold text-base min-h-14 px-9 py-3.5 rounded-full tracking-wide transition hover:bg-white hover:-translate-y-0.5 animate-fade-up animate-delay-500"
          >
            イベントご参加の方はこちら
            <span aria-hidden="true" className="text-xl leading-none font-normal -mr-1">→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-2xl mt-14 sm:mt-20 text-center">
        <h2 className="font-zenkaku text-lg sm:text-2xl font-bold text-ink-700 leading-snug tracking-wide">
          なんでもない日々が輝きだす
        </h2>
        <p lang="en" className="font-dm text-sm sm:text-base text-ink-400 tracking-wide mt-2">
          Ordinary days begin to shine.
        </p>
        <p className="font-zenkaku text-sm sm:text-base text-ink-500 leading-loose mt-8">
          からだを動かし、気の合う仲間と出会い、
          <br />
          毎日に新しい彩りが生まれる。
          <br />
          運動からはじまる、大人のウェルネスコミュニティ。
        </p>
        <p lang="en" className="font-dm text-xs sm:text-sm text-ink-300 leading-relaxed mt-4">
          Move your body, meet people you click with,
          <br />
          and find new color in every day.
          <br />
          A wellness community for grown-ups,
          <br className="sm:hidden" /> beginning with movement.
        </p>
      </section>

      <section className="mx-auto max-w-5xl mt-16 sm:mt-24">
        <h2 className="text-center mb-8 font-sans font-bold uppercase text-[28px] sm:text-[31px] leading-tight text-navy">
          Program
        </h2>
        <ProgramCarousel />
      </section>
    </main>
    <Footer />
    </div>
  );
}
