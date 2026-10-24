import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT = "/auth/reset-password";

// "//host" や "/\host" はブラウザが外部サイトとして解釈するため、単独の "/" 始まりのみ許可する
function sanitizeNext(next: string | null | undefined): string {
  if (!next) return DEFAULT_NEXT;
  const isSameSitePath = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  return isSameSitePath ? next : DEFAULT_NEXT;
}

// パスワード再設定・メールアドレス変更のメールのリンク先。メールテンプレートの
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`（type=email_change）から遷移する。
// GET では検証しない。メールクライアントやセキュリティスキャナがリンクを先読みすると、
// 1回限りの token_hash が消費されて本人のクリックが「リンクが無効です」になるため、
// 確認ページ（/auth/verify）へ渡すだけにする。
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !type) {
    redirect("/auth/reset-password?error=invalid_link");
  }

  const params = new URLSearchParams({ token_hash: tokenHash, type });
  const next = searchParams.get("next");
  if (next) params.set("next", sanitizeNext(next));
  redirect(`/auth/verify?${params.toString()}`);
}

// 確認ページのボタン（フォーム送信）から呼ばれる。token_hash をサーバー側で verifyOtp して
// Cookie にリカバリーセッションを確立してから /auth/reset-password へリダイレクトする
// （PKCE の code_verifier に依存しないため、別端末・別ブラウザでメールを開いても再設定できる）。
// POST への 307 はブラウザがリダイレクト先にも POST を再送するため、303 で GET に切り替える。
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const next = form.get("next");

  const destination = new URL(sanitizeNext(typeof next === "string" ? next : null), request.url);
  const invalid = () =>
    NextResponse.redirect(new URL("/auth/reset-password?error=invalid_link", request.url), 303);

  if (typeof tokenHash !== "string" || !tokenHash || typeof type !== "string" || !type) {
    return invalid();
  }

  const supabase = createClient();

  // メールアドレス変更の確認メール（テンプレート「Change Email Address」）からのリンク。
  // Secure email change では新旧両方のアドレスに確認メールが届き、1通目の確認ではセッションが返らず、
  // 2通目の確認でセッションが返って変更が確定する。結果はログイン不要の /auth/email-change で伝える
  if (type === "email_change") {
    const { data, error } = await supabase.auth.verifyOtp({ type: "email_change", token_hash: tokenHash });
    const result = (status: "done" | "pending" | "invalid") =>
      NextResponse.redirect(new URL(`/auth/email-change?status=${status}`, request.url), 303);
    if (error) {
      Sentry.captureMessage("Email change link verification failed", {
        level: "warning",
        tags: { area: "auth_email_change" },
        extra: { supabaseErrorCode: error.code, supabaseErrorStatus: error.status, supabaseErrorName: error.name, supabaseErrorText: error.message },
      });
      return result("invalid");
    }
    return result(data.session ? "done" : "pending");
  }

  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
  if (!error) return NextResponse.redirect(destination, 303);

  // 同じリンクを2回開いた・ボタンを二重に押した場合、1回目の検証でセッションが既に確立済みで、
  // 2回目だけが「使用済み」で失敗する。セッションがあるなら、そのまま先へ進める
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(destination, 303);

  // 失敗の理由（期限切れ・使用済み等）を後から調べられるよう、個人情報を含まない情報だけ記録する
  // （Sentry は "code"/"message" というキー名をマスクするため別名で送る）
  Sentry.captureMessage("Recovery link verification failed", {
    level: "warning",
    tags: { area: "auth_recovery" },
    extra: { supabaseErrorCode: error.code, supabaseErrorStatus: error.status, supabaseErrorName: error.name, supabaseErrorText: error.message },
  });
  return invalid();
}
