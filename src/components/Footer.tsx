import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full py-6 px-4">
      <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link href="/legal/tokushoho" className="font-outfit text-[11px] text-ink-300 hover:text-ink-500 transition">
          特定商取引法に基づく表記
        </Link>
        <Link href="/legal/privacy" className="font-outfit text-[11px] text-ink-300 hover:text-ink-500 transition">
          プライバシーポリシー
        </Link>
      </div>
    </footer>
  );
}
