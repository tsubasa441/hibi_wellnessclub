import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { encrypt } from "@/lib/encrypt";
import { sendEmailChangeRequest } from "@/lib/email";
import { EMAIL_CHANGE_TTL_MINUTES, generateEmailChangeToken, hashEmailChangeToken } from "@/lib/emailChange";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "メールアドレスの変更を受け付けられませんでした。時間をおいて、もう一度お試しください。";

// メールアドレス変更の申し込み（マイページから）。現在のパスワードを確かめて申し込みを保存し、今のアドレスへ確認メールを送る。
// そのリンクが押されるまで、Supabase には何も申し込まない（/api/account/email/confirm）。
// Supabase に直接申し込まれても確定できないよう、テンプレート Change Email Address からはリンクを外している
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  // パスワードの総当たりを防ぐため、申し込みの回数を絞る
  if (!(await checkRateLimit(`email-change:${user.id}`, 5, 600))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = (await req.json()) as { email?: unknown; currentPassword?: unknown };
  const newEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

  if (!newEmail || !currentPassword) {
    return NextResponse.json({ error: "未入力項目があります" }, { status: 400 });
  }
  if (newEmail.length > 254 || !EMAIL_REGEX.test(newEmail)) {
    return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }
  if (newEmail === user.email.toLowerCase()) {
    return NextResponse.json({ error: "現在のメールアドレスと同じです" }, { status: 400 });
  }

  const authClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // 本人以外がログイン中の端末を操作しただけで変更できないよう、現在のパスワードを確かめる
  const { error: signInError } = await authClient.auth.signInWithPassword({ email: user.email, password: currentPassword });
  if (signInError) {
    return NextResponse.json({ error: "現在のパスワードが正しくありません" }, { status: 400 });
  }

  // 確認のためだけに作ったセッションは、この端末のログイン状態に影響させずに破棄する
  await authClient.auth.signOut({ scope: "local" });

  const svc = createServiceClient();
  const token = generateEmailChangeToken();
  const { error: saveError } = await svc.from("email_change_requests").upsert(
    {
      user_id: user.id,
      new_email: encrypt(newEmail),
      token_hash: hashEmailChangeToken(token),
      expires_at: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (saveError) {
    // 個人情報（メールアドレス）は記録しない
    Sentry.captureMessage("Email change request failed", { level: "warning", tags: { area: "auth_email_change" } });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  const sent = await sendEmailChangeRequest({ to: user.email, newEmail, token, expiresMinutes: EMAIL_CHANGE_TTL_MINUTES });
  if (!sent) {
    await svc.from("email_change_requests").delete().eq("user_id", user.id);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
