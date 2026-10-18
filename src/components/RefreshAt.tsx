"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 画面を開いたまま指定の時刻（例: 表示中のイベントの一番早い終了時刻）を過ぎたら、
// サーバーの表示を取り直す。終了したイベントのカードを自動で消すために使う
export default function RefreshAt({ at }: { at: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!at) return;
    const delay = new Date(at).getTime() - Date.now() + 1000;
    // setTimeout の上限（約24.8日）を超える先の時刻は、その頃には画面を開き直しているはずなので見送る
    if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
    const timer = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timer);
  }, [at, router]);

  return null;
}
