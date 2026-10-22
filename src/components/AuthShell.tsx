import type { ReactNode, Ref } from "react";
import Image from "next/image";
import Link from "next/link";

// 認証系の画面（ログイン・新規登録・登録完了・パスワード再設定）の共通の外枠。
// トップ・ホームと同じ nav-bg の背景に、ロゴと白いカードを置く（2026-10-22、依頼者の指定で写真パネルから変更）
export default function AuthShell({
  above,
  children,
  topRef,
}: {
  above?: ReactNode;
  children: ReactNode;
  topRef?: Ref<HTMLDivElement>;
}) {
  return (
    <main className="min-h-svh bg-nav-bg px-4 sm:px-6 pb-16">
      <div className="text-center pt-6 pb-6 sm:pt-8 sm:pb-8 animate-fade-up">
        <Link href="/" className="inline-flex flex-col items-center">
          <Image src="/images/hibi-logo.png" alt="Hibi" width={540} height={236} priority className="h-8 sm:h-9 w-auto" />
          <span className="font-dm text-xs sm:text-sm text-ink-500 tracking-[0.1em] mt-1">wellness club</span>
        </Link>
      </div>

      <div ref={topRef} className="mx-auto w-full max-w-md scroll-mt-4">
        {above}
        <div className="bg-white rounded-[20px] p-5 sm:p-7 shadow-[0_1px_4px_rgba(44,53,49,0.08)] animate-fade-up animate-delay-200">
          {children}
        </div>
      </div>
    </main>
  );
}
