import { NextResponse, type NextRequest } from "next/server";
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

// パスワード再設定メールのリンク先。メールテンプレートの
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` から遷移する。
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

  if (typeof tokenHash === "string" && tokenHash && typeof type === "string" && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(sanitizeNext(typeof next === "string" ? next : null), request.url), 303);
    }
  }

  return NextResponse.redirect(new URL("/auth/reset-password?error=invalid_link", request.url), 303);
}
