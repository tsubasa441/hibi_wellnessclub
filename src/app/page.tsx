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
          className="mt-4 bg-white/90 text-ink-700 font-outfit font-medium text-sm px-8 py-3 rounded-full hover:bg-white transition tracking-wider animate-fade-up animate-delay-500"
        >
          イベントご参加の方はこちら
        </Link>
      </div>
    </main>
  );
}
