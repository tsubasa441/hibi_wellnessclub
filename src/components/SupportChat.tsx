"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SUPPORT_MESSAGE_MAX_LENGTH, type SupportMessage } from "@/lib/support";

const REFRESH_MS = 20000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

type Props = {
  messages: SupportMessage[];
  // 送信先 API（ユーザー：/api/support/messages、運営：/api/admin/support/[userId]/messages）
  postUrl: string;
  // 自分の吹き出しを右側に出す
  viewer: "user" | "admin";
  emptyText: string;
  placeholder: string;
};

// お問い合わせのチャット（ユーザーのお問い合わせ画面・管理画面で共通）。
// 開いている間は20秒ごとに新着を取り直す
export default function SupportChat({ messages, postUrl, viewer, emptyText, placeholder }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) {
      setError(json.error ?? "送信に失敗しました");
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-base-200 p-4 min-h-[40svh] space-y-3">
        {messages.length === 0 ? (
          <p className="font-dm text-sm text-ink-300 text-center py-10 whitespace-pre-line">{emptyText}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender === viewer;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                  <p className="font-outfit text-[11px] text-ink-300 mb-1 px-1">
                    {m.sender === "admin" ? "Hibi 運営" : "ユーザー"}
                  </p>
                )}
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl font-dm text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mine ? "bg-sage-600 text-white rounded-br-sm" : "bg-base-100 text-ink-700 rounded-bl-sm"
                  }`}
                >
                  {m.body}
                </div>
                <p className="font-dm text-[10px] text-ink-300 mt-1 px-1">{formatTime(m.created_at)}</p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="bg-white border border-base-200 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
          rows={3}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent font-dm text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none"
        />
        {error && <p className="font-dm text-xs text-red-500 mt-1">{error}</p>}
        <div className="flex items-center justify-between mt-2">
          <p className="font-dm text-[11px] text-ink-300">
            {[...text].length} / {SUPPORT_MESSAGE_MAX_LENGTH}
          </p>
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="bg-sage-600 text-white font-outfit text-sm font-medium px-6 py-2 rounded-full hover:bg-sage-500 transition disabled:opacity-50"
          >
            {sending ? "送信中..." : "送信する"}
          </button>
        </div>
      </div>
    </div>
  );
}
