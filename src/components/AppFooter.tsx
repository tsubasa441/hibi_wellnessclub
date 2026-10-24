import Link from "next/link";
import Image from "next/image";

const LINKS: { label: string; href: string }[] = [
  { label: "よくあるご質問", href: "/faq" },
  { label: "利用規約", href: "/legal/terms" },
  { label: "プライバシーポリシー", href: "/legal/privacy" },
  { label: "特定商取引法に基づく表記", href: "/legal/tokushoho" },
];

// ログイン後の画面（ホーム・イベント一覧・インパクト・マイページ）の最下部に置くフッター。
// 親の main を flex-col にして mt-auto で下端に寄せ、固定の下ナビに隠れないよう下に余白を取る（2026-10-24、依頼者の指定）
export default function AppFooter() {
  return (
    // 色はトップ・法定ページの Footer と同じ（bg-ink-700・白文字・白いロゴ。2026-10-24、依頼者の指定）
    // リンクを2行×2列（短いもの同士・長いもの同士を縦に組む）にして高さを詰める（2026-10-24、高いとの指摘で）。
    // 下の余白は、下ナビから浮いているチェックインの丸ボタンがリンクに重ならない高さ
    <footer className="mt-auto w-full bg-ink-700 text-white pt-3 pb-[5.75rem]">
      <div className="max-w-2xl mx-auto px-4 flex items-center justify-center gap-4 sm:gap-10">
        <Link href="/home" className="shrink-0 flex flex-col items-center">
          <Image src="/images/hibi-logo-white.png" alt="Hibi" width={540} height={236} className="h-5 sm:h-7 w-auto" />
          <span className="font-dm text-[10px] sm:text-xs text-white/80 tracking-[0.1em] mt-0.5 sm:mt-1">wellness club</span>
        </Link>
        <ul className="grid grid-flow-col grid-rows-2 gap-x-3 gap-y-1 sm:gap-x-8">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block leading-5 font-dm text-[11px] sm:text-xs text-white/80 whitespace-nowrap hover:text-white transition">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
