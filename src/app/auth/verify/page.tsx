import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { headingClass, bodyTextClass } from "@/lib/authStyles";
import VerifyForm from "./VerifyForm";

// パスワード再設定メールのリンクの遷移先。ここでは token_hash を検証しない（メールクライアントや
// セキュリティスキャナのリンク先読みで、1回限りのトークンが消費されるのを防ぐため）。
// ボタンを押すと POST /auth/confirm が検証し、リカバリーセッションを確立する。
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;

  if (!tokenHash || !type) {
    redirect("/auth/reset-password?error=invalid_link");
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className={headingClass}>パスワードの再設定</p>
          <p className={bodyTextClass}>
            下のボタンを押して、新しいパスワードの設定に進んでください。
          </p>
        </div>

        <VerifyForm tokenHash={tokenHash} type={type} next={next ?? ""} />

        <p className="font-dm text-xs text-ink-300 leading-relaxed">
          このリンクは、一度だけ使えます。
        </p>
      </div>
    </AuthShell>
  );
}
