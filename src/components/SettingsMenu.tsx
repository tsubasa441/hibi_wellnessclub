"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import * as Sentry from "@sentry/nextjs";
import PasswordInput from "@/components/PasswordInput";
import { validatePasswordFormat } from "@/lib/passwordPolicy";
import { passwordUpdateErrorMessage } from "@/lib/passwordUpdateError";
import { inputClass, labelClass } from "@/lib/authStyles";
import { useSquareCard, STORE_VERIFICATION } from "@/lib/useSquareCard";

export type SavedCard = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null;

type Props = {
  nickname: string;
  email: string | null;
  savedCard: SavedCard;
};

// マイページの設定メニュー（2026-10-16 にヘッダーの設定ドロワーから移設）
export default function SettingsMenu({ nickname, email, savedCard }: Props) {
  const router = useRouter();
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
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailRequested, setEmailRequested] = useState(false);
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
        extra: { supabaseErrorCode: error.code, supabaseErrorStatus: error.status, supabaseErrorName: error.name },
      });
      setPasswordError(passwordUpdateErrorMessage(error));
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDone(true);
  }

  function resetEmailForm() {
    setEditingEmail(false);
    setNewEmail("");
    setEmailPassword("");
    setEmailError(null);
    setEmailRequested(false);
  }

  // 申し込みのみ。切り替わるのは新旧両方のアドレスに届く確認メールのリンクが押されたとき
  async function handleRequestEmailChange() {
    setEmailError(null);
    if (!newEmail.trim() || !emailPassword) {
      setEmailError("未入力項目があります");
      return;
    }

    setSavingEmail(true);
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, currentPassword: emailPassword }),
    });
    const json = await res.json();
    setSavingEmail(false);

    if (!res.ok) {
      setEmailError(json.error ?? "メールアドレスの変更を受け付けられませんでした");
      return;
    }

    setEmailPassword("");
    setEmailRequested(true);
  }

  function resetCardForm() {
    setEditingCard(false);
    setCardSaveError(null);
  }

  async function handleSaveCard() {
    setCardSaveError(null);
    setSavingCard(true);

    try {
      const sourceId = await tokenizeCard(STORE_VERIFICATION);
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
    <div className="space-y-5">
      <section>
        <h2 className="font-outfit text-sm font-semibold text-ink-500 tracking-wide mb-2 px-1">アカウント設定</h2>
        <div className="bg-white -mx-4 sm:mx-0">
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
                  className="bg-ink-500 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-base-200 hover:text-ink-700 transition disabled:opacity-60"
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

          {/* メールアドレス変更 */}
          {editingEmail ? (
            <div className="px-5 py-4 border-b border-base-200">
              <p className="font-outfit text-xs text-ink-300 mb-2">メールアドレスを変更する</p>
              {emailRequested ? (
                <div className="space-y-3">
                  <p className="font-dm text-xs text-ink-500 leading-relaxed">
                    確認メールをお送りしました。今のメールアドレスと新しいメールアドレスの両方に届いたメールのリンクを押すと、変更が完了します。それまでは、今のメールアドレスでログインしてください。
                  </p>
                  <button onClick={resetEmailForm} className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition">
                    閉じる
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className={labelClass}>新しいメールアドレス</p>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      autoComplete="email"
                      maxLength={254}
                      className={inputClass}
                      placeholder="example@example.com"
                    />
                  </div>
                  <div>
                    <p className={labelClass}>現在のパスワード</p>
                    <PasswordInput value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                  </div>
                  {emailError && <p className="font-dm text-xs text-red-500">{emailError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestEmailChange}
                      disabled={savingEmail}
                      className="bg-ink-500 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-base-200 hover:text-ink-700 transition disabled:opacity-60"
                    >
                      {savingEmail ? "送信中..." : "確認メールを送る"}
                    </button>
                    <button onClick={resetEmailForm} className="font-outfit text-xs text-ink-300 hover:text-ink-500 transition px-4 py-2">
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <MenuRow label="メールアドレスを変更する" sublabel={email ?? undefined} onClick={() => setEditingEmail(true)} />
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
                      className="bg-ink-500 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-base-200 hover:text-ink-700 transition disabled:opacity-60"
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
            <div className="px-5 py-4">
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
                  className="bg-ink-500 text-white font-outfit text-xs font-medium px-4 py-2 rounded-sm hover:bg-base-200 hover:text-ink-700 transition disabled:opacity-60"
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
              label="クレジットカードを設定する"
              sublabel={
                currentCard
                  ? `${currentCard.brand ?? "カード"} •••• ${currentCard.last4}（有効期限 ${String(currentCard.expMonth).padStart(2, "0")}/${String(currentCard.expYear).slice(-2)}）`
                  : "登録されていません"
              }
              onClick={() => setEditingCard(true)}
              showBorder={false}
            />
          )}
        </div>
      </section>

      <section className="bg-white -mx-4 sm:mx-0">
        <MenuRow label={loggingOut ? "ログアウト中..." : "ログアウト"} onClick={handleLogout} disabled={loggingOut} />
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
      </section>
    </div>
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
