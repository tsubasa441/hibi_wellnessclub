"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  nickname: string;
};

export default function SettingsDrawer({ nickname }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentNickname, setCurrentNickname] = useState(nickname);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(nickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function closeDrawer() {
    setOpen(false);
    setEditingNickname(false);
    setNicknameError(null);
    setNicknameInput(currentNickname);
  }

  async function handleSaveNickname() {
    setSavingNickname(true);
    setNicknameError(null);

    const res = await fetch("/api/profile/nickname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: nicknameInput }),
    });
    const json = await res.json();

    if (!res.ok) {
      setNicknameError(json.error ?? "ニックネームの変更に失敗しました");
      setSavingNickname(false);
      return;
    }

    setCurrentNickname(json.nickname);
    setNicknameInput(json.nickname);
    setEditingNickname(false);
    setSavingNickname(false);
    router.refresh();
  }

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        "退会しますか？\n\n" +
          "氏名・性別・生年月日等の個人情報は削除・匿名化され、二度とログインできなくなります。\n" +
          "予約・決済・ポイント等の履歴は記録として残ります（他の方の紹介実績表示等に影響しないためです）。\n\n" +
          "この操作は取り消せません。"
      )
    ) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    const res = await fetch("/api/account/delete", { method: "POST" });
    const json = await res.json();

    if (!res.ok) {
      setDeleteError(json.error ?? "退会に失敗しました");
      setDeleting(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/?accountDeleted=1");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="設定"
        className="text-ink-700 hover:text-ink-800 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50" onClick={closeDrawer}>
          <div
            className="fixed inset-y-0 right-0 w-full max-w-xs bg-white shadow-xl flex flex-col animate-slide-in-right"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
              <h2 className="font-outfit text-base font-semibold text-ink-700">設定</h2>
              <button onClick={closeDrawer} aria-label="閉じる" className="text-ink-300 hover:text-ink-700 transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* ニックネーム変更 */}
              {editingNickname ? (
                <div className="px-5 py-4 border-b border-base-200">
                  <p className="font-outfit text-xs text-ink-300 mb-2">ニックネーム</p>
                  <input
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    maxLength={20}
                    autoFocus
                    className="nm-inset w-full px-4 py-2.5 font-outfit text-sm text-ink-700 focus:outline-none"
                  />
                  {nicknameError && (
                    <p className="font-dm text-xs text-red-500 mt-2">{nicknameError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveNickname}
                      disabled={savingNickname}
                      className="nm-btn-primary text-white font-outfit text-xs font-medium px-4 py-2 disabled:opacity-60"
                    >
                      {savingNickname ? "保存中..." : "保存する"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNickname(false);
                        setNicknameInput(currentNickname);
                        setNicknameError(null);
                      }}
                      className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition px-4 py-2"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <MenuRow label="ニックネーム" sublabel={currentNickname} onClick={() => setEditingNickname(true)} />
              )}

              {/* ログアウト */}
              <MenuRow label={loggingOut ? "ログアウト中..." : "ログアウト"} onClick={handleLogout} disabled={loggingOut} />

              {/* 退会 */}
              {deleteError && (
                <p className="font-dm text-xs text-red-500 px-5 pt-4">{deleteError}</p>
              )}
              <MenuRow
                label={deleting ? "退会処理中..." : "退会"}
                onClick={handleDelete}
                disabled={deleting}
                muted
                showBorder={false}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuRow({
  label,
  sublabel,
  onClick,
  disabled = false,
  muted = false,
  showBorder = true,
}: {
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
  showBorder?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-base-100 transition disabled:opacity-60 ${
        showBorder ? "border-b border-base-200" : ""
      }`}
    >
      <div>
        <p className={`font-outfit text-sm ${muted ? "text-ink-500" : "text-ink-700"}`}>{label}</p>
        {sublabel && <p className="font-dm text-xs text-ink-300 mt-0.5">{sublabel}</p>}
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink-300 flex-shrink-0">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}
