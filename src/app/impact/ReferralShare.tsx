"use client";

import { useState } from "react";

type Props = {
  referralUrl: string;
  code: string;
};

export default function ReferralShare({ referralUrl, code }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: "Hibi に参加しよう", url: referralUrl });
    } else {
      handleCopy();
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleShare}
        className="w-full font-outfit font-semibold text-xs nm-btn-primary text-white py-2"
      >
        紹介リンクをシェア
      </button>
      <button
        onClick={handleCopy}
        className="w-full font-outfit text-xs text-ink-500 border border-ink-500 rounded-xl py-2 hover:bg-base-100 transition"
      >
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
    </div>
  );
}
