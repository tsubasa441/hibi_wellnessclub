"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass = "w-full bg-white/20 text-white placeholder-white/40 font-dm text-sm px-4 py-3 rounded-full focus:outline-none focus:bg-white/30";
const labelClass = "font-outfit text-xs text-white/70 tracking-widest mb-2";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password || !confirm) {
      setError("未入力項目があります");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません");
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    if (password.length < 8 || password.length > 72 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      setError("パスワードは、半角英大文字・小文字・数字・記号をすべて含み、8文字以上で入力してください。");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。");
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 -z-10">
        <Image src="/images/top.png" alt="background" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-outfit text-3xl font-medium text-white tracking-wide">Hibi</span>
        </div>

        <div className="flex justify-center mb-6">
          <span className="font-outfit text-lg font-medium pb-1 text-white border-b-2 border-white">
            パスワード再設定
          </span>
        </div>

        {error && <div className="text-red-300 text-xs font-dm mb-4">{error}</div>}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <p className={labelClass}>新しいパスワード</p>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="英大文字・小文字・数字・記号を含む8文字以上"
            />
          </div>
          <div>
            <p className={labelClass}>パスワード（確認）</p>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
              placeholder="もう一度入力してください"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white/90 text-ink-700 font-outfit font-medium py-3 rounded-full hover:bg-white transition disabled:opacity-60 mt-4"
          >
            {loading ? "更新中..." : "パスワードを更新"}
          </button>
        </form>
      </div>
    </main>
  );
}
