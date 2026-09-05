import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// パスワード再設定メールの送信。未認証（ログイン前）で呼ばれるため、ユーザーIDではなく
// IPアドレスでレート制限する。
//
// クライアント側の supabase-js（@supabase/ssr の createBrowserClient）は flowType が
// 既定で "pkce" のため、そこから直接 resetPasswordForEmail() を呼ぶと、メールに載る
// token_hash が PKCE の code_challenge に紐づいた値（`pkce_` プレフィックス）になる。
// この値は申請元ブラウザに保存された code_verifier がないと検証できず、
// /auth/confirm の verifyOtp では常に「リンクが無効です」になってしまう（BUG-9で
// 別端末限定の不具合として一度対応したが、実際のメール経由フローでは同一端末でも
// 再現することが判明）。flowType が既定 "implicit" の service_role クライアント
// （@supabase/supabase-js の createClient、PKCEを使わない）からサーバー側で呼び出す
// ことで、verifyOtp と互換性のある通常の token_hash を発行させる。
export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(`forgot-password:${getClientIp(req)}`, 5, 300))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim();
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const supabase = createServiceClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  });

  if (error) {
    return NextResponse.json(
      { error: "メールの送信に失敗しました。しばらく経ってから再試行してください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
