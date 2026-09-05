"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body className="bg-base-100 text-ink-500">
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="font-outfit text-2xl font-medium text-ink-700">Hibi</p>
          <p className="font-dm text-sm text-ink-500">
            予期しないエラーが発生しました。しばらくしてから再度お試しください。
          </p>
        </main>
      </body>
    </html>
  );
}
