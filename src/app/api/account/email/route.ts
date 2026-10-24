import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERIC_ERROR = "メールアドレスの変更を受け付けられませんでした。時間をおいて、もう一度お試しください。";

// メールアドレス変更の申し込み（マイページから）。現在のパスワードを確かめてから Supabase に変更を申し込む。
// 実際の切り替えは、新旧両方のアドレスに届く確認メールのリンクが押された時点（Supabase の Secure email change）。
// 申し込みは PKCE を使わないクライアントで行う。@supabase/ssr のクライアント（flowType 既定 "pkce"）から
// 申し込むと、確認メールの token_hash が /auth/confirm の verifyOtp で検証できない値になるため（BUG-10 と同じ）
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

  const { error: updateError } = await authClient.auth.updateUser({ email: newEmail });
  // 確認のためだけに作ったセッションは、この端末のログイン状態に影響させずに破棄する
  await authClient.auth.signOut({ scope: "local" });

  if (updateError) {
    if (updateError.code === "email_exists") {
      return NextResponse.json({ error: "このメールアドレスは使用できません" }, { status: 400 });
    }
    if (updateError.code === "email_address_invalid") {
      return NextResponse.json({ error: "メールアドレスの形式が正しくありません" }, { status: 400 });
    }
    if (updateError.code === "over_email_send_rate_limit" || updateError.status === 429) {
      return NextResponse.json({ error: "メールの送信回数が上限に達しました。しばらくしてから、もう一度お試しください。" }, { status: 429 });
    }
    // 個人情報（メールアドレス）は記録しない（Sentry は "code"/"message" というキー名をマスクするため別名で送る）
    Sentry.captureMessage("Email change request failed", {
      level: "warning",
      tags: { area: "auth_email_change" },
      extra: { supabaseErrorCode: updateError.code, supabaseErrorStatus: updateError.status, supabaseErrorName: updateError.name },
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
