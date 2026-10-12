import type { Metadata } from "next";
import { Outfit, Cormorant_Garamond, DM_Sans, M_PLUS_Rounded_1c, Bebas_Neue, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const maru = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-maru",
  display: "swap",
});
// トップページのヒーロー見出し専用（2026-10-12、依頼者が比較のうえ選択）
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });
// トップページの紹介文（日本語）用。日本語の文字は unicode-range で必要な分だけ読み込まれるため preload しない
const zenKaku = Zen_Kaku_Gothic_New({ subsets: ["latin"], weight: "400", variable: "--font-zenkaku", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "Hibi | フィットネスコミュニティ",
  description: "ヨガ・トレーニング・ランニング・ボクシングのフィットネスイベントに参加しよう",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${outfit.variable} ${cormorant.variable} ${dmSans.variable} ${maru.variable} ${bebas.variable} ${zenKaku.variable} font-dm bg-base-100 text-ink-500 overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
