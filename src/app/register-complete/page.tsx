import Link from "next/link";

export default function RegisterCompletePage({
  searchParams,
}: {
  searchParams: { profileError?: string };
}) {
  const profileError = searchParams.profileError === "1";

  return (
    <main className="relative min-h-screen app-bg flex items-start sm:items-center justify-center px-4 pt-16 sm:pt-0">
      <div className="relative z-10 w-full max-w-sm nm-card p-6 sm:p-8 text-center space-y-6 animate-fade-up animate-delay-100">
        <div>
          <span className="font-outfit text-3xl font-medium text-ink-700 tracking-wide">Hibi</span>
        </div>

        <div className="space-y-2">
          <p className="font-cormorant text-2xl font-semibold text-ink-700 tracking-wide">
            Welcome to Hibi
          </p>
          <p className="font-dm text-sm text-ink-300 leading-relaxed">
            登録が完了しました。
          </p>
          {profileError && (
            <p className="font-dm text-xs text-ink-500 leading-relaxed bg-base-100 rounded-lg p-3">
              ログインは可能ですが、プロフィール情報（性別・生年月日・紹介コード等）の保存に失敗しました。ログイン後、プロフィールをご確認のうえ再度ご登録いただくか、サポートまでご連絡ください。
            </p>
          )}
        </div>

        <Link
          href="/login"
          className="block w-full nm-btn-primary text-white font-outfit font-medium py-3 text-sm tracking-wider"
        >
          今すぐログイン
        </Link>
      </div>
    </main>
  );
}
