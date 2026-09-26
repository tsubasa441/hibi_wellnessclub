import { redirect } from "next/navigation";
import AuthPhotoPanel from "@/components/AuthPhotoPanel";
import { headingClass } from "@/lib/authStyles";
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
    <main className="min-h-screen flex flex-col sm:flex-row bg-base-100">
      <AuthPhotoPanel />

      <div className="flex-1 flex items-start sm:items-center justify-center px-5 py-10 sm:py-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-3">
            <p className={headingClass}>パスワードの再設定</p>
            <p className="font-dm text-sm text-ink-400 leading-relaxed">
              下のボタンを押して、新しいパスワードの設定に進んでください。
            </p>
          </div>

          <VerifyForm tokenHash={tokenHash} type={type} next={next ?? ""} />

          <p className="font-dm text-xs text-ink-300 leading-relaxed">
            このリンクは、一度だけ使えます。
          </p>
        </div>
      </div>
    </main>
  );
}
