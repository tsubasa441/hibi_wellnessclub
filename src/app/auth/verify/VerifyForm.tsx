"use client";

import { useEffect, useState } from "react";

// ボタンの二重押しで、1回目の検証がトークンを消費したあとに2回目が失敗してしまうのを防ぐ
export default function VerifyForm({
  tokenHash,
  type,
  next,
}: {
  tokenHash: string;
  type: string;
  next: string;
}) {
  const [submitting, setSubmitting] = useState(false);

  // 「戻る」で戻ってきたとき（bfcache）にボタンが押せないままにならないよう戻す
  useEffect(() => {
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      method="POST"
      action="/auth/confirm"
      onSubmit={(e) => {
        if (submitting) {
          e.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        disabled={submitting}
        className="w-full nm-btn-primary text-white font-outfit font-medium py-3 disabled:opacity-40"
      >
        {submitting ? "確認しています..." : "パスワードを再設定する"}
      </button>
    </form>
  );
}
