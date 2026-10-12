import Link from "next/link";
import Footer from "@/components/Footer";
import HeroBackground, { type HeroSlide } from "./HeroBackground";
import ProgramCarousel from "./ProgramCarousel";

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
      {accountDeleted && (
        <p className="mx-auto mt-4 max-w-5xl font-dm text-xs text-ink-500 bg-white border border-base-200 rounded-2xl px-4 py-2 text-center">
          アカウントを削除しました。ご利用ありがとうございました。
        </p>
      )}

      <div className="text-center pt-6 pb-6 sm:pt-8 sm:pb-8 animate-fade-up">
        <h1 className="font-outfit text-4xl sm:text-5xl font-medium text-ink-700 tracking-wide">Hibi</h1>
        <p className="font-outfit text-xs sm:text-sm text-ink-500 tracking-[0.3em] mt-1">wellness club</p>
      </div>

      <section className="relative mx-auto max-w-5xl h-[30svh] sm:h-[38svh] min-h-[220px] max-h-[380px] rounded-2xl overflow-hidden">
        <HeroBackground slides={HERO_SLIDES} />
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="font-bebas text-[30px] sm:text-[52px] text-white leading-none tracking-[0.04em] uppercase drop-shadow-lg animate-fade-up animate-delay-200">
            The city is your studio.
          </p>
          <p className="-mt-1 font-outfit text-[10px] sm:text-xs text-white/90 tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap uppercase drop-shadow animate-fade-up animate-delay-300">
            Run · Training · Boxing · Yoga · Pilates
          </p>
          <Link
            href="/login"
            className="mt-1 inline-flex items-center gap-1.5 whitespace-nowrap bg-white/95 text-ink-700 font-outfit font-semibold text-xs px-5 py-2.5 rounded-full tracking-wide transition hover:bg-white hover:-translate-y-0.5 animate-fade-up animate-delay-500"
          >
            イベントご参加の方はこちら
            <span aria-hidden="true" className="text-sm leading-none font-normal -mr-0.5">→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-2xl mt-14 sm:mt-20 text-center">
        <p className="inline-flex items-end gap-2">
          <span className="font-sans italic font-medium uppercase text-2xl sm:text-[31px] leading-none text-navy">Welcome to</span>
          <span className="font-outfit font-medium text-[34px] sm:text-[42px] leading-[0.8] tracking-wide text-ink-700">Hibi</span>
        </p>
        <h2 className="font-yugothic text-2xl sm:text-4xl font-bold text-ink-700 leading-snug tracking-wide mt-4">
          なんでもない日々が輝きだす
        </h2>
        <p lang="en" className="font-outfit text-sm sm:text-base text-ink-400 tracking-wide mt-2">
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
