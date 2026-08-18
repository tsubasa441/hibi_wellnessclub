"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass = "w-full bg-base-50 border border-base-200 text-ink-700 placeholder-ink-200 font-dm text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-ink-300 transition";
const labelClass = "font-outfit text-xs text-sage-500 font-medium tracking-widest mb-1.5";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      setError("パスワードを正しく設定してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError("パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。");
    } else {
      setDone(true);
    }
  }

  async function handleContinue() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen app-bg flex items-start sm:items-center justify-center px-4 pt-16 sm:pt-0">
      <div className="relative z-10 w-full max-w-sm nm-card p-6 sm:p-8 animate-fade-up">
        <div className="text-center mb-3">
          <span className="font-outfit text-3xl font-medium text-ink-700 tracking-wide">Hibi</span>
        </div>

        {done ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full border border-sage-300 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-500">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-cormorant text-xl font-semibold text-ink-700 tracking-wide">
                完了しました
              </p>
              <p className="font-dm text-sm text-ink-300 leading-relaxed">
                パスワードの再設定が完了しました。
              </p>
            </div>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full nm-btn-primary text-white font-outfit font-medium py-3 text-sm tracking-wider"
            >
              ログイン画面へ
            </button>
          </div>
        ) : (
          <>
            <p className="text-center font-outfit text-sm font-medium text-ink-700 mb-6">
              パスワード再設定
            </p>

            {error && <div className="text-red-500 text-xs font-dm mb-4 text-center">{error}</div>}

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
                className="w-full nm-btn-primary text-white font-outfit font-medium py-3 disabled:opacity-40 mt-4"
              >
                {loading ? "更新中..." : "パスワードを更新"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
