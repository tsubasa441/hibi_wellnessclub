import { redirect } from "next/navigation";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";

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
    <>
      <PublicHeader />
      <main className="relative min-h-screen app-bg flex items-start sm:items-center justify-center px-4 pt-16 sm:pt-0">
        <div className="relative z-10 w-full max-w-sm nm-card p-6 sm:p-8 text-center space-y-6 animate-fade-up animate-delay-100">
          <div className="space-y-2">
            <p className="font-cormorant text-2xl font-semibold text-ink-700 tracking-wide">パスワードの再設定</p>
            <p className="font-dm text-sm text-ink-500 leading-relaxed">
              下のボタンを押して、新しいパスワードの設定に進んでください。
            </p>
          </div>

          <form method="POST" action="/auth/confirm">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next ?? ""} />
            <button
              type="submit"
              className="w-full nm-btn-primary text-white font-outfit font-medium py-3"
            >
              パスワードを再設定する
            </button>
          </form>

          <p className="font-dm text-xs text-ink-300 leading-relaxed">
            このリンクは、一度だけ使えます。
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
