"use client";

import { useEffect, useState } from "react";
import { primaryButtonClass } from "@/lib/authStyles";

// トークンは1回限りのため、ボタンの二重押しで2回目が失敗しないようにする（VerifyForm と同じ）
export default function ConfirmForm({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const reset = () => setSubmitting(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <form
      method="POST"
      action="/api/account/email/confirm"
      onSubmit={(e) => {
        if (submitting) {
          e.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={submitting} className={primaryButtonClass}>
        {submitting ? "確認しています..." : "変更の手続きを進める"}
      </button>
    </form>
  );
}
