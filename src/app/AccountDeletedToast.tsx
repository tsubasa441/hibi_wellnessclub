"use client";

import { useEffect, useState } from "react";
import Toast from "@/components/Toast";

const VISIBLE_MS = 4000;

// 退会直後（/?accountDeleted=1）に一度だけお知らせを出す。再読み込みで出続けないよう URL の印はすぐ消す
// （router.replace だとページが描き直されてお知らせごと消えるため、履歴だけを書き換える）
export default function AccountDeletedToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    window.history.replaceState(null, "", "/");
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <Toast message="アカウントを削除しました。ご利用ありがとうございました。" />;
}
