import Link from "next/link";
import Image from "next/image";

const LINKS: { label: string; href: string }[] = [
  { label: "お問い合わせ", href: "/support" },
  { label: "利用規約", href: "/legal/terms" },
  { label: "プライバシーポリシー", href: "/legal/privacy" },
  { label: "特定商取引法に基づく表記", href: "/legal/tokushoho" },
];

// ログイン後の画面（ホーム・イベント一覧・インパクト・マイページ）の最下部に置くフッター。
// 親の main を flex-col にして mt-auto で下端に寄せ、固定の下ナビに隠れないよう下に余白を取る（2026-10-24、依頼者の指定）
export default function AppFooter() {
  return (
    <footer className="mt-auto w-full bg-base-200/60 pt-8 pb-28">
      <div className="max-w-2xl mx-auto px-6 flex items-center justify-center gap-10">
        <Link href="/home" className="shrink-0 flex flex-col items-center">
          <Image src="/images/hibi-logo.png" alt="Hibi" width={540} height={236} className="h-8 w-auto" />
          <span className="font-dm text-xs text-ink-500 tracking-[0.1em] mt-1">wellness club</span>
        </Link>
        <ul className="space-y-2.5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="font-dm text-xs text-ink-500 hover:text-ink-700 transition">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
