import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { headingClass, primaryButtonClass } from "@/lib/authStyles";

export default function NotFound() {
  return (
    <AuthShell>
      <h1 className={`${headingClass} mb-3`}>ページが見つかりません</h1>
      <p className="font-dm text-sm text-ink-500 mb-6">
        お探しのページは、移動または削除された可能性があります。
      </p>
      <Link href="/" className={primaryButtonClass}>
        トップページへ戻る
      </Link>
    </AuthShell>
  );
}
