import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { primaryButtonClass, headingEnClass, bodyTextClass } from "@/lib/authStyles";

export default async function RegisterCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ profileError?: string }>;
}) {
  const profileError = (await searchParams).profileError === "1";

  return (
    <AuthShell>
      <div className="space-y-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-600">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 3 3 5-6" />
        </svg>

        <div className="space-y-3">
          <p className={headingEnClass}>Welcome to Hibi!</p>
          <p className={bodyTextClass}>
            登録が完了しました。<br />
            ログインしてイベントをご確認ください。
          </p>
          {profileError && (
            <p className="font-dm text-xs text-ink-500 leading-relaxed border-l-2 border-sage-300 pl-3">
              ログインは可能ですが、プロフィール情報（性別・生年月日・紹介コード等）の保存に失敗しました。ログイン後、プロフィールをご確認のうえ再度ご登録いただくか、サポートまでご連絡ください。
            </p>
          )}
        </div>

        <Link href="/login" className={primaryButtonClass}>
          ログインへ進む
        </Link>
      </div>
    </AuthShell>
  );
}
