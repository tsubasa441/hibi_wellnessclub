import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { decrypt } from "@/lib/encrypt";
import { sendEmailChangeConfirmation } from "@/lib/email";
import { hashEmailChangeToken } from "@/lib/emailChange";

// 今のアドレスに届いたリンクの確認ページのボタンから呼ばれる（メールを開いた端末で押されるので、ログインは求めない）。
// トークンが本人確認の代わり。1回使うと消える
export async function POST(req: NextRequest) {
  const result = (status: "sent" | "taken" | "invalid") =>
    NextResponse.redirect(new URL(`/auth/email-change?status=${status}`, req.url), 303);

  if (!(await checkRateLimit(`email-change-confirm:${getClientIp(req)}`, 10, 600))) return result("invalid");

  const form = await req.formData();
  const token = form.get("token");
  if (typeof token !== "string" || !token) return result("invalid");

  const svc = createServiceClient();
  const { data: request } = await svc
    .from("email_change_requests")
    .delete()
    .eq("token_hash", hashEmailChangeToken(token))
    .select("user_id, new_email, expires_at")
    .maybeSingle();
  if (!request || new Date(request.expires_at).getTime() < Date.now()) return result("invalid");

  const { data: userData } = await svc.auth.admin.getUserById(request.user_id);
  const currentEmail = userData?.user?.email;
  if (!currentEmail) return result("invalid");

  // 種類は email_change_current を使う。email_change_new の hashed_token は verifyOtp で検証できなかった
  // （2026-11-01 に実機で確認）。どちらも1回限りのトークンで、送り先はこちらが決めるため、安全性は変わらない。
  // generateLink はメールを送らないので、確認メールは Hibi から新しいアドレスへ送る
  const newEmail = decrypt(request.new_email);
  const { data: link, error } = await svc.auth.admin.generateLink({ type: "email_change_current", email: currentEmail, newEmail });
  if (error || !link?.properties?.hashed_token) {
    if (error?.code === "email_exists") return result("taken");
    // 個人情報（メールアドレス）は記録しない（Sentry は "code"/"message" というキー名をマスクするため別名で送る）
    Sentry.captureMessage("Email change link generation failed", {
      level: "warning",
      tags: { area: "auth_email_change" },
      extra: { supabaseErrorCode: error?.code, supabaseErrorStatus: error?.status, supabaseErrorName: error?.name },
    });
    return result("invalid");
  }

  const sent = await sendEmailChangeConfirmation({ to: newEmail, tokenHash: link.properties.hashed_token });
  return result(sent ? "sent" : "invalid");
}
