import Image from "next/image";
import Link from "next/link";

export default function AuthPhotoPanel() {
  return (
    <div className="relative w-full sm:w-[42%] h-[200px] sm:h-screen sm:sticky sm:top-0 shrink-0">
      <Image src="/images/hibi-top-poster.jpg" alt="" fill priority className="object-cover" />
      <div className="absolute inset-0 bg-ink-800/40" />
      <div className="relative h-full flex flex-col justify-between p-6 sm:p-12">
        <Link href="/" className="inline-block">
          <span className="font-outfit text-3xl sm:text-5xl font-medium text-white tracking-wide">Hibi</span>
          <p className="font-outfit text-[10px] sm:text-xs tracking-[0.3em] text-white/75 uppercase mt-1 sm:mt-2">Wellness Club</p>
        </Link>
        <div className="hidden sm:block max-w-sm">
          <p className="font-cormorant text-2xl leading-relaxed text-white font-medium">
            なんでもない日々が、<br />輝きだす。
          </p>
          <p className="font-dm text-xs leading-loose text-white/70 mt-4">
            からだを動かし、気の合う仲間と出会い、毎日に新しい彩りが生まれる。運動からはじまる、大人のウェルネスコミュニティ。
          </p>
        </div>
      </div>
    </div>
  );
}
