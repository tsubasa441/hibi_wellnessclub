import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// パスワード再設定メールのリンク先。メールテンプレートの
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` から遷移する。
// token_hash をサーバー側で verifyOtp して Cookie にリカバリーセッションを確立してから
// /auth/reset-password へリダイレクトする（PKCE の code_verifier に依存しないため、
// 別端末・別ブラウザでメールを開いてもパスワード再設定できる）。
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/auth/reset-password";
  const safeNext = next.startsWith("/") ? next : "/auth/reset-password";

  if (tokenHash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(safeNext);
    }
  }

  redirect("/auth/reset-password?error=invalid_link");
}
