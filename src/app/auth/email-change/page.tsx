import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { headingClass, bodyTextClass, primaryButtonClass } from "@/lib/authStyles";

const MESSAGES = {
  done: {
    heading: "メールアドレスを変更しました",
    body: "次回から、新しいメールアドレスでログインしてください。",
  },
  pending: {
    heading: "もう1通のメールも確認してください",
    body: "変更前と変更後の、両方のメールアドレスに確認メールをお送りしています。もう一方のメールのリンクも押すと、変更が完了します。",
  },
  sent: {
    heading: "新しいメールアドレスに確認メールを送りました",
    body: "届いたメールのリンクを押すと、変更が完了します。それまでは、今のメールアドレスでログインしてください。",
  },
  taken: {
    heading: "このメールアドレスは使用できません",
    body: "お手数ですが、マイページから別のメールアドレスで、もう一度お申し込みください。",
  },
  invalid: {
    heading: "リンクが無効です",
    body: "有効期限が切れているか、既に使用されています。お手数ですが、マイページからもう一度変更してください。",
  },
} as const;

function isMessageKey(status: string | undefined): status is keyof typeof MESSAGES {
  return status !== undefined && Object.hasOwn(MESSAGES, status);
}

// メールアドレス変更の確認メールのリンクを押したあとの結果（POST /auth/confirm・/api/account/email/confirm から遷移。ログイン不要）
export default async function EmailChangePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const message = isMessageKey(status) ? MESSAGES[status] : MESSAGES.invalid;

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className={headingClass}>{message.heading}</p>
          <p className={bodyTextClass}>{message.body}</p>
        </div>
        <Link href="/mypage" className={primaryButtonClass}>
          マイページへ
        </Link>
      </div>
    </AuthShell>
  );
}
