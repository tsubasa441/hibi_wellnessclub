import Link from "next/link";

// 公式アカウントの URL。空のものはアイコンごと表示しない
const SOCIAL_LINKS: { name: string; href: string; icon: React.ReactNode }[] = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/hibi_wellnessclub/",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@hibi_wellnessclub",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path d="M13 7v6.2a2.4 2.4 0 1 1-2.4-2.4" />
        <path d="M13 7c.3 1.6 1.4 2.7 3.2 2.9" />
      </svg>
    ),
  },
];

const LEGAL_LINKS: { label: string; href: string }[] = [
  { label: "利用規約", href: "/legal/terms" },
  { label: "プライバシーポリシー", href: "/legal/privacy" },
  { label: "特定商取引法に基づく表記", href: "/legal/tokushoho" },
];

export default function Footer() {
  const socialLinks = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <footer className="nm-nav-bottom w-full py-7 px-4">
      <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
        {socialLinks.length > 0 && (
          <div className="flex items-center justify-center gap-6">
            {socialLinks.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="text-ink-700 hover:text-ink-800 transition"
              >
                {s.icon}
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="font-outfit text-[11px] text-ink-700 hover:text-ink-800 transition">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
