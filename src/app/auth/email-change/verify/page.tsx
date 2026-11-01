import { redirect } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { headingClass, bodyTextClass } from "@/lib/authStyles";
import ConfirmForm from "./ConfirmForm";

// 今のアドレスに届いたリンクの遷移先。ここではトークンを使わない（リンクの先読みで消費されないように、ボタンの POST で進める）
export default async function EmailChangeVerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/auth/email-change?status=invalid");

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className={headingClass}>メールアドレスの変更</p>
          <p className={bodyTextClass}>下のボタンを押すと、新しいメールアドレスに確認メールをお送りします。</p>
        </div>

        <ConfirmForm token={token} />

        <p className="font-dm text-xs text-ink-300 leading-relaxed">
          お心当たりがない場合は、ボタンを押さずにこの画面を閉じて、パスワードを変更してください。
        </p>
      </div>
    </AuthShell>
  );
}
