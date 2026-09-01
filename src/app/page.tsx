import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden">
      <Image
        src="/images/top.png"
        alt="Hibi background"
        fill
        className="object-cover object-center"
        priority
      />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex flex-col items-center mt-[25vh] gap-8 px-4">
        <h1 className="font-outfit text-5xl font-medium text-white tracking-wide drop-shadow-lg animate-fade-up animate-delay-100">
          Hibi
        </h1>
        <p className="font-cormorant text-xs font-light text-white/90 tracking-[0.3em] drop-shadow -mt-6 animate-fade-up animate-delay-200">
          Wellness Club
        </p>
        <div className="flex flex-col items-center gap-3 text-center animate-fade-up animate-delay-300">
          <p className="font-dm text-sm text-white font-medium drop-shadow">
            なんでもない日々が、輝きだす。
          </p>
          <p className="font-cormorant text-[8.5px] text-white/80 leading-loose tracking-normal drop-shadow whitespace-nowrap">
            からだを動かし、気の合う仲間と出会い、毎日に新しい彩りが生まれる。<br />
            運動からはじまる、大人のウェルネスコミュニティ。
          </p>
        </div>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-2 whitespace-nowrap bg-white text-ink-700 font-outfit font-semibold text-sm px-7 py-3.5 rounded-full tracking-wide transition-all duration-150 will-change-transform
            shadow-[0_10px_22px_-6px_rgba(0,0,0,0.38),0_2px_4px_rgba(0,0,0,0.22),inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-4px_5px_rgba(44,53,49,0.14)]
            hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-6px_rgba(0,0,0,0.42),0_3px_6px_rgba(0,0,0,0.26),inset_0_2px_1px_rgba(255,255,255,0.95),inset_0_-4px_5px_rgba(44,53,49,0.14)]
            active:translate-y-1 active:shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_3px_6px_rgba(44,53,49,0.22)]
            animate-fade-up animate-delay-500"
        >
          イベントご参加の方はこちら
          <span aria-hidden="true" className="text-lg leading-none font-normal -mr-1">→</span>
        </Link>
      </div>
    </main>
  );
}
