// 下線の入力欄。マイページのアカウント設定（SettingsMenu）で使う
export const inputClass = "w-full border-0 border-b border-base-200 bg-transparent text-ink-700 placeholder-ink-200 font-dm text-sm px-0.5 py-2.5 focus:outline-none focus:border-ink-500 transition [color-scheme:light]";
export const labelClass = "font-outfit text-[11px] text-sage-500 font-medium tracking-[0.12em] uppercase mb-1.5";

// 以下は認証系の画面（ログイン・新規登録・登録完了・パスワード再設定）用。ホームのテイストに揃える（2026-10-22、依頼者の指定）
export const boxedInputClass = "w-full rounded-lg border border-base-200 bg-base-50 text-ink-700 placeholder-ink-200 font-dm text-sm px-3.5 py-2.5 focus:outline-none focus:border-sage-600 focus:bg-white transition [color-scheme:light]";
export const boxedLabelClass = "font-dm text-xs text-ink-400 tracking-wide mb-1.5";
export const primaryButtonClass = "flex items-center justify-center w-full min-h-12 bg-ink-500 text-white font-dm font-semibold text-sm tracking-wide rounded-md hover:bg-ink-600 transition disabled:opacity-40";
export const linkButtonClass = "font-dm text-xs text-ink-300 hover:text-ink-700 transition";
// 英語の見出し（Hello! 等）は Bebas、日本語の見出しは Zen Kaku（Bebas に日本語の字形が無いため）
export const headingEnClass = "font-bebas text-[34px] leading-none tracking-[0.04em] uppercase text-ink-700";
export const headingClass = "font-zenkaku text-lg font-bold text-ink-700 tracking-wide";
export const bodyTextClass = "font-dm text-sm text-ink-400 leading-relaxed";
