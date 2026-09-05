"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccountButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !confirm(
        "アカウントを削除しますか？\n\n" +
          "氏名・性別・生年月日等の個人情報は削除・匿名化され、二度とログインできなくなります。\n" +
          "予約・決済・ポイント等の履歴は記録として残ります（他の方の紹介実績表示等に影響しないためです）。\n\n" +
          "この操作は取り消せません。"
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/account/delete", { method: "POST" });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? "アカウントの削除に失敗しました");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/?accountDeleted=1");
    router.refresh();
  }

  return (
    <div className="text-center pt-2">
      {error && (
        <p className="font-dm text-xs text-ink-500 bg-base-100 rounded-lg px-4 py-3 mb-3">{error}</p>
      )}
      <button
        onClick={handleDelete}
        disabled={loading}
        className="font-outfit text-xs text-ink-300 hover:text-ink-500 underline underline-offset-2 transition disabled:opacity-50"
      >
        {loading ? "削除中..." : "アカウントを削除する"}
      </button>
    </div>
  );
}
