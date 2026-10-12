import Link from "next/link";

const iconProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

// 公式アカウント・連絡先。href が空のものは表示しない
const CONTACT_LINKS: { name: string; value: string; href: string; external: boolean; icon: React.ReactNode }[] = [
  {
    name: "Instagram",
    value: "@hibi_wellnessclub",
    href: "https://www.instagram.com/hibi_wellnessclub/",
    external: true,
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    value: "@hibi_wellnessclub",
    href: "https://www.tiktok.com/@hibi_wellnessclub",
    external: true,
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <path d="M13 7v6.2a2.4 2.4 0 1 1-2.4-2.4" />
        <path d="M13 7c.3 1.6 1.4 2.7 3.2 2.9" />
      </svg>
    ),
  },
  {
    name: "Email",
    value: "hibi.wellnessclub@gmail.com",
    href: "mailto:hibi.wellnessclub@gmail.com",
    external: false,
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="M4 7l8 6 8-6" />
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
  const contactLinks = CONTACT_LINKS.filter((c) => c.href);

  return (
    <footer className="w-full bg-ink-700 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-outfit text-2xl font-medium tracking-wide leading-none">Hibi</p>
          <p className="font-outfit text-xs text-white/80 tracking-[0.3em] mt-1">wellness club</p>
          <p className="font-zenkaku text-xs text-white/80 mt-3">なんでもない日々が輝きだす</p>
          <p lang="en" className="font-dm text-[11px] text-white/60">Ordinary days begin to shine.</p>
        </div>

        {contactLinks.length > 0 && (
          <div>
            <p className="font-sans font-bold text-sm">Stay Updated With Us</p>
            <ul className="mt-2 space-y-1.5">
              {contactLinks.map((c) => (
                <li key={c.name}>
                  <a
                    href={c.href}
                    {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex items-center gap-2 text-xs text-white/90 hover:text-white transition break-all"
                  >
                    {c.icon}
                    <span className="font-outfit">{c.name}</span>
                    <span className="font-dm text-white/70">{c.value}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-ink-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-dm text-xs text-white/70">© 2026 Hibi Wellness Club. All Rights Reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="font-outfit text-[11px] text-white/80 hover:text-white transition">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
