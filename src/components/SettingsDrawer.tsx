"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";
import PasswordInput from "@/components/PasswordInput";
import { validatePasswordFormat } from "@/lib/passwordPolicy";
import { passwordUpdateErrorMessage } from "@/lib/passwordUpdateError";
import { inputClass, labelClass } from "@/lib/authStyles";
import { useSquareCard } from "@/lib/useSquareCard";

type SavedCard = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null;

type Props = {
  nickname: string;
  savedCard?: SavedCard;
};

export default function SettingsDrawer({ nickname, savedCard = null }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [currentNickname, setCurrentNickname] = useState(nickname);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(nickname);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  const [currentCard, setCurrentCard] = useState<SavedCard>(savedCard);
  const [editingCard, setEditingCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [cardSaveError, setCardSaveError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { error: cardTokenizeError, tokenize: tokenizeCard } = useSquareCard(
    "settings-card-container",
    editingCard,
    process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
  );

  useEffect(() => {
    // 現在のパスワード確認（signInWithPassword）に使うメールアドレスを取得しておく。
    // getSession はブラウザ側で Cookie を読むだけで通信しない
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setEmail(session?.user.email ?? null);
    })();
  }, []);

  function resetPasswordForm() {
    setEditingPassword(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordDone(false);
  }

  async function handleSavePassword() {
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("未入力項目があります");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("新しいパスワードが一致しません");
      return;
    }
    const formatError = validatePasswordFormat(newPassword);
    if (formatError) {
      setPasswordError(formatError);
      return;
    }
    if (!email) {
      setPasswordError("パスワードの変更に失敗しました。時間をおいて、もう一度お試しください。");
      return;
    }

    setSavingPassword(true);
    const supabase = createClient();

    // 現在のパスワードが正しいことを確認してから変更する（本人以外がログイン中の端末を
    // 操作しただけでパスワードを変更できてしまわないようにするため）
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (signInError) {
      setPasswordError("現在のパスワードが正しくありません");
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      Sentry.captureMessage("Password update failed in settings drawer", {
        level: "warning",
        tags: { area: "auth_settings" },
        extra: { authErrorCode: error.code, authErrorStatus: error.status, authErrorName: error.name },
      });
      setPasswordError(passwordUpdateErrorMessage(error));
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDone(true);
  }

  function resetCardForm() {
    setEditingCard(false);
    setCardSaveError(null);
  }

  async function handleSaveCard() {
    setCardSaveError(null);
    setSavingCard(true);

    try {
      const sourceId = await tokenizeCard();
      const res = await fetch("/api/payment-methods/square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "カードの保存に失敗しました");

      setCurrentCard({ brand: json.brand, last4: json.last4, expMonth: json.expMonth, expYear: json.expYear });
      setEditingCard(false);
    } catch (err) {
      setCardSaveError(err instanceof Error ? err.message : "カードの保存に失敗しました");
    } finally {
      setSavingCard(false);
    }
  }

  function closeDrawer() {
    setOpen(false);
    setEditingNickname(false);
    setNicknameError(null);
    setNicknameInput(currentNickname);
    resetPasswordForm();
    resetCardForm();
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
          "氏名・性別・生年月日等の個人情報は削除・匿名化され、二度とログインできなくなります。\n\n" +
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
                  <p className="font-outfit text-xs text-ink-300 mb-2">名前を変更する</p>
                  <input
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    maxLength={20}
                    autoFocus
                    className="w-full border-0 border-b border-base-200 bg-transparent px-0.5 py-2.5 font-outfit text-sm text-ink-700 focus:outline-none focus:border-ink-500 transition"
                  />
                  {nicknameError && (
                    <p className="font-dm text-xs text-red-500 mt-2">{nicknameError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveNickname}
                      disabled={savingNickname}
                      className="bg-sage-600 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-sage-500 transition disabled:opacity-60"
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
                <MenuRow label="名前を変更する" sublabel={currentNickname} onClick={() => setEditingNickname(true)} />
              )}

              {/* パスワード変更 */}
              {editingPassword ? (
                <div className="px-5 py-4 border-b border-base-200">
                  <p className="font-outfit text-xs text-ink-300 mb-2">パスワードを変更する</p>
                  {passwordDone ? (
                    <div className="space-y-3">
                      <p className="font-dm text-xs text-ink-500">パスワードを変更しました。</p>
                      <button onClick={resetPasswordForm} className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition">
                        閉じる
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className={labelClass}>現在のパスワード</p>
                        <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                      </div>
                      <div>
                        <p className={labelClass}>新しいパスワード</p>
                        <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                        <p className="font-dm text-xs text-ink-300 mt-1">8〜15文字で、半角英大文字・英小文字・数字・記号をすべて含めてください</p>
                      </div>
                      <div>
                        <p className={labelClass}>新しいパスワード（確認）</p>
                        <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} placeholder="もう一度入力してください" />
                      </div>
                      {passwordError && <p className="font-dm text-xs text-red-500">{passwordError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSavePassword}
                          disabled={savingPassword}
                          className="bg-sage-600 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-sage-500 transition disabled:opacity-60"
                        >
                          {savingPassword ? "変更中..." : "変更する"}
                        </button>
                        <button onClick={resetPasswordForm} className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition px-4 py-2">
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <MenuRow label="パスワードを変更する" onClick={() => setEditingPassword(true)} />
              )}

              {/* クレジットカード */}
              {editingCard ? (
                <div className="px-5 py-4 border-b border-base-200">
                  <p className="font-outfit text-xs text-ink-300 mb-2">
                    {currentCard ? "カードを変更する" : "カードを登録する"}
                  </p>
                  {process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT !== "production" && (
                    <p className="font-dm text-xs text-ink-300 mb-2">
                      テスト環境です。ZIPは「00000」と入力してください
                    </p>
                  )}
                  <div id="settings-card-container" />
                  {(cardSaveError || cardTokenizeError) && (
                    <p className="font-dm text-xs text-red-500 mt-2">{cardSaveError ?? cardTokenizeError}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveCard}
                      disabled={savingCard}
                      className="bg-sage-600 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-sage-500 transition disabled:opacity-60"
                    >
                      {savingCard ? "保存中..." : "保存する"}
                    </button>
                    <button onClick={resetCardForm} className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition px-4 py-2">
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <MenuRow
                  label="クレジットカード"
                  sublabel={
                    currentCard
                      ? `${currentCard.brand ?? "カード"} •••• ${currentCard.last4}（有効期限 ${String(currentCard.expMonth).padStart(2, "0")}/${String(currentCard.expYear).slice(-2)}）`
                      : "登録されていません"
                  }
                  onClick={() => setEditingCard(true)}
                />
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
