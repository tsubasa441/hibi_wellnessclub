"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";
import * as Sentry from "@sentry/nextjs";
import { passwordUpdateErrorMessage } from "@/lib/passwordUpdateError";
import AuthPhotoPanel from "@/components/AuthPhotoPanel";
import { inputClass, labelClass, primaryButtonClass, headingClass } from "@/lib/authStyles";

type LinkStatus = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [invalidDetail, setInvalidDetail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const markReady = () => {
      if (settled) return;
      settled = true;
      setLinkStatus("ready");
    };
    const markInvalid = (detail?: string | null) => {
      if (settled) return;
      settled = true;
      if (detail) setInvalidDetail(detail);
      setLinkStatus("invalid");
    };

    // Supabaseはリンク無効時にhashまたはqueryへerror系パラメータを付与してリダイレクトしてくる
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const errParam = hashParams.get("error") || queryParams.get("error");
    const errDesc =
      hashParams.get("error_description") ||
      queryParams.get("error_description") ||
      hashParams.get("error_code") ||
      queryParams.get("error_code");
    if (errParam) {
      markInvalid(errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : null);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        markReady();
      }
    });

    // /auth/confirm がサーバー側で verifyOtp 済みなら Cookie にセッションがある。
    // hash/クエリのトークン検出（detectSessionInUrl）が非同期で走るケースも含め、
    // 数回 getSession をポーリングして確立を待つ。
    let tries = 0;
    const poll = setInterval(async () => {
      tries += 1;
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        clearInterval(poll);
        markReady();
      } else if (tries >= 16) {
        clearInterval(poll);
        markInvalid();
      }
    }, 500);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
    };
  }, []);

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

    if (password.length > 15) {
      setError("パスワードは15文字以内で入力してください");
      return;
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    if (password.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      setError("パスワードを正しく設定してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // 失敗の種類だけ記録する（パスワードやメールアドレスは含めない）
      Sentry.captureMessage("Password update failed on reset page", {
        level: "warning",
        tags: { area: "auth_recovery" },
        extra: { authErrorCode: error.code, authErrorStatus: error.status, authErrorName: error.name },
      });
      setError(passwordUpdateErrorMessage(error));
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
    <main className="min-h-screen flex flex-col sm:flex-row bg-base-100">
      <AuthPhotoPanel />

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          {linkStatus === "checking" ? (
            <p className="font-dm text-sm text-ink-300">リンクを確認しています...</p>
          ) : linkStatus === "invalid" ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className={headingClass}>リンクが無効です</p>
                <p className="font-dm text-sm text-ink-400 leading-relaxed">
                  このリンクの有効期限が切れているか、既に使用されています。メールを複数回送信した場合は、最後に届いたメールのリンクのみ有効です。お手数ですが、もう一度パスワード再設定をお試しください。
                </p>
                {invalidDetail && (
                  <p className="font-dm text-[11px] text-ink-200 leading-relaxed break-all">
                    {invalidDetail}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => router.push("/login")} className={primaryButtonClass}>
                ログイン画面へ
              </button>
            </div>
          ) : done ? (
            <div className="space-y-6">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 3 3 5-6" />
              </svg>
              <div className="space-y-3">
                <p className={headingClass}>完了しました</p>
                <p className="font-dm text-sm text-ink-400 leading-relaxed">
                  パスワードの再設定が完了しました。
                </p>
              </div>
              <button type="button" onClick={handleContinue} className={primaryButtonClass}>
                ログイン画面へ
              </button>
            </div>
          ) : (
            <>
              <p className={`${headingClass} mb-6`}>パスワード再設定</p>

              {error && <div className="text-red-500 text-xs font-dm mb-4">{error}</div>}

              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div>
                  <p className={labelClass}>新しいパスワード</p>
                  <PasswordInput
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                  <p className="font-dm text-xs text-ink-300 mt-2">8〜15文字で、以下をすべて含めてください</p>
                  <p className="font-dm text-xs text-ink-300">半角英大文字・半角英小文字・数字・記号</p>
                </div>
                <div>
                  <p className={labelClass}>パスワード（確認）</p>
                  <PasswordInput
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={inputClass}
                    placeholder="もう一度入力してください"
                  />
                </div>
                <button type="submit" disabled={loading} className={primaryButtonClass}>
                  {loading ? "更新中..." : "パスワードを更新"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
