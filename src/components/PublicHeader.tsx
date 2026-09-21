import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="nm-nav-top relative z-20">
      <div className="max-w-2xl mx-auto px-5 py-4 sm:px-8 flex items-center justify-between">
        <Link href="/" className="font-outfit text-2xl font-bold text-ink-700 tracking-wide">
          Hibi
        </Link>
      </div>
    </header>
  );
}
