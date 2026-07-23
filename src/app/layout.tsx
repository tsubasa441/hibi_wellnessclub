import type { Metadata } from "next";
import { Outfit, Cormorant_Garamond, DM_Sans, M_PLUS_Rounded_1c } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Hibi | フィットネスコミュニティ",
  description: "ヨガ・トレーニング・ランニング・ボクシングのフィットネスイベントに参加しよう",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${outfit.variable} ${cormorant.variable} ${dmSans.variable} ${maru.variable} font-dm bg-base-100 text-ink-500 overflow-x-hidden`}>
        {children}
      </body>
    </html>
  );
}
