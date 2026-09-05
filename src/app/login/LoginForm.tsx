"use client";

import { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";
import Footer from "@/components/Footer";

type Tab = "signin" | "signup" | "forgot";
type Gender = "male" | "female" | "other";

const inputClass = "w-full bg-base-50 border border-base-200 text-ink-700 placeholder-ink-200 font-dm text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-ink-300 transition";
const labelClass = "font-outfit text-xs text-sage-500 font-medium tracking-widest mb-1.5";
const toggleClass = (active: boolean) =>
  `flex-1 py-1.5 rounded-xl font-outfit text-xs font-medium transition border ${
    active
      ? "bg-ink-500 border-ink-500 text-white"
      : "bg-base-50 border-base-200 text-ink-400"
  }`;

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get("ref") ? "signup" : "signin");
  const formTopRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [referralCode, setReferralCode] = useState(searchParams.get("ref") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = useMemo(
    () => Array.from({ length: currentYear - 1900 + 1 }, (_, i) => currentYear - i),
    [currentYear]
  );
  const MONTH_OPTIONS = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
  const DAY_OPTIONS = useMemo(() => {
    const max = birthYear && birthMonth ? daysInMonth(Number(birthYear), Number(birthMonth)) : 31;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [birthYear, birthMonth]);

  // 年・月を変更した結果、選択済みの日がその月に存在しなくなった場合はリセットする（例: 31日→2月）
  useEffect(() => {
    if (birthYear && birthMonth && birthDay && Number(birthDay) > daysInMonth(Number(birthYear), Number(birthMonth))) {
      setBirthDay("");
    }
  }, [birthYear, birthMonth, birthDay]);

  const birthDate =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`
      : "";

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function resetForm() {
    setName("");
    setNickname("");
    setEmail("");
    setPassword("");
    setGender("");
    setBirthYear("");
    setBirthMonth("");
    setBirthDay("");
    setReferralCode(searchParams.get("ref") ?? "");
    setError(null);
    setResetSent(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email) {
      showError("メールアドレスを入力してください");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    // 末尾スラッシュがあるとSupabaseのRedirect URL許可リストと一致せずフォールバックされるため除去する
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      showError("メールの送信に失敗しました。しばらく経ってから再試行してください。");
    } else {
      setError(null);
      setResetSent(true);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      showError("未入力項目があります");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
    } else {
      router.push("/home");
      router.refresh();
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !nickname || !email || !password || !gender || !birthDate) {
      showError("未入力項目があります");
      return;
    }

    // 名前：日本語・英字・スペースのみ、1〜30文字
    const trimmedName = name.trim();
    if (trimmedName.length > 30) {
      showError("30文字以内で入力してください");
      return;
    }
    const nameRegex = /^[a-zA-Z぀-ゟ゠-ヿ一-龯･-ﾟ\s　]{1,30}$/;
    if (!nameRegex.test(trimmedName)) {
      showError("お名前は日本語・英字のみ入力してください");
      return;
    }

    // ニックネーム：日本語・英数字・スペースのみ、1〜20文字
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length > 20) {
      showError("ニックネームは20文字以内で入力してください");
      return;
    }
    const nicknameRegex = /^[a-zA-Z0-9぀-ゟ゠-ヿ一-龯･-ﾟ\s　]{1,20}$/;
    if (!nicknameRegex.test(trimmedNickname)) {
      showError("ニックネームは日本語・英数字のみ入力してください");
      return;
    }

    // メール：標準形式・最大254文字
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      showError("メールアドレスの形式が正しくありません");
      return;
    }

    // パスワード：大文字・小文字・数字・記号すべて含む、8〜15文字
    if (password.length > 15) {
      showError("パスワードは15文字以内で入力してください");
      return;
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    if (password.length < 8 || !hasUpper || !hasLower || !hasDigit || !hasSymbol) {
      showError("パスワードを正しく設定してください");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // 紹介コードの存在チェック
    if (referralCode.trim()) {
      const { data: isValidReferralCode } = await supabase.rpc("referral_code_exists", {
        p_code: referralCode.trim().toUpperCase(),
      });
      if (!isValidReferralCode) {
        showError("紹介コードが正しくありません");
        setLoading(false);
        return;
      }
    }

    // ローマ字変換
    let nameRoman = name;
    try {
      const res = await fetch("/api/convert-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        nameRoman = data.romaji ?? name;
      }
    } catch {
      // 変換失敗時は元の名前をそのまま使用
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("password")) {
        showError("パスワードを正しく設定してください");
      } else {
        showError("このメールアドレスは既に使用されています");
      }
      setLoading(false);
      return;
    }

    // メール確認なし環境では既存メールでも成功するが identities が空になる
    if (!signUpData.user || signUpData.user.identities?.length === 0) {
      showError("このメールアドレスは既に使用されています");
      setLoading(false);
      return;
    }

    if (signUpData.user) {
      const profileBody = JSON.stringify({
        name: name.trim(),
        nameRoman,
        nickname: nickname.trim(),
        gender,
        birthDate,
        referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
      });
      const postProfile = () =>
        fetch("/api/signup/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: profileBody,
        });

      let profileRes = await postProfile();
      if (!profileRes.ok) {
        // 一時的な失敗の可能性があるため1回だけ再試行する
        profileRes = await postProfile();
      }
      if (!profileRes.ok) {
        // アカウント自体は作成済みのためサインアップ画面には戻さず、
        // プロフィール情報の保存に失敗したことが分かる状態で完了画面へ進める
        router.push("/register-complete?profileError=1");
        setLoading(false);
        return;
      }
    }

    router.push("/register-complete");
  }

  return (
    <>
    <main className="relative min-h-screen app-bg flex items-start sm:items-center justify-center px-4 pt-4 sm:pt-0 pb-4 sm:pb-10">
      <div className="relative z-10 w-full max-w-sm nm-card p-5 sm:p-8 animate-fade-up">
        <div className="text-center mb-3">
          <span className="font-outfit text-3xl font-medium text-ink-700 tracking-wide">Hibi</span>
        </div>

        <div ref={formTopRef} className="mb-3">
          {tab !== "forgot" ? (
            <div className="flex gap-1 p-1 rounded-full bg-base-100 border border-base-200">
              <button
                onClick={() => { setTab("signin"); resetForm(); }}
                className={`flex-1 py-2 rounded-full font-outfit text-sm font-medium transition ${tab === "signin" ? "bg-sage-500 text-white" : "text-ink-300"}`}
              >
                ログイン
              </button>
              <button
                onClick={() => { setTab("signup"); resetForm(); }}
                className={`flex-1 py-2 rounded-full font-outfit text-sm font-medium transition ${tab === "signup" ? "bg-sage-500 text-white" : "text-ink-300"}`}
              >
                新規登録
              </button>
            </div>
          ) : (
            <p className="text-center font-outfit text-sm font-medium text-ink-700">
              パスワード再設定
            </p>
          )}
        </div>

        {error && <div className="text-red-500 text-xs font-dm mb-4 text-center">{error}</div>}

        {tab === "signin" ? (
          <form onSubmit={handleSignIn} noValidate className="space-y-4">
            <div>
              <p className={labelClass}>EMAIL</p>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
            </div>
            <div>
              <p className={labelClass}>PASSWORD</p>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setTab("forgot"); resetForm(); }}
                className="font-dm text-xs text-ink-300 hover:text-ink-700 transition"
              >
                パスワードをお忘れの方
              </button>
            </div>
            <button type="submit" disabled={loading} className="w-full nm-btn-primary text-white font-outfit font-medium py-3 disabled:opacity-40 mt-4">
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>
        ) : tab === "forgot" ? (
          resetSent ? (
            <div className="space-y-4 text-center">
              <div className="flex justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-sage-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 3 3 5-6" />
                </svg>
              </div>
              <div>
                <p className="font-outfit text-sm font-medium text-ink-700">メールを送信しました</p>
                <p className="font-dm text-xs text-ink-300 leading-relaxed mt-2">
                  {email} 宛にパスワード再設定用のメールをお送りしました。メール内のリンクから新しいパスワードを設定してください。
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTab("signin"); resetForm(); }}
                className="w-full nm-btn-primary text-white font-outfit font-medium py-2.5"
              >
                ログインに戻る
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} noValidate className="space-y-3">
              <p className="font-dm text-xs text-ink-300 leading-relaxed text-center">
                登録済みのメールアドレスを入力してください。
              </p>
              <div>
                <p className={labelClass}>EMAIL</p>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
              </div>
              <button type="submit" disabled={loading} className="w-full nm-btn-primary text-white font-outfit font-medium py-2 disabled:opacity-40">
                {loading ? "送信中..." : "メールを送信"}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setTab("signin"); resetForm(); }}
                  className="font-dm text-xs text-ink-300 hover:text-ink-700 transition"
                >
                  ログインに戻る
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={handleSignUp} noValidate className="space-y-2">
            <div>
              <p className={labelClass}>NAME</p>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="山田 太郎" />
            </div>
            <div>
              <p className={labelClass}>NICKNAME</p>
              <input type="text" required value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputClass} placeholder="タロウ" />
            </div>
            <div>
              <p className={labelClass}>EMAIL</p>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
            </div>
            <div>
              <p className={labelClass}>PASSWORD</p>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
              <p className="font-dm text-xs text-ink-300 mt-1">8〜15文字で、以下をすべて含めてください</p>
              <p className="font-dm text-xs text-ink-300">半角英大文字・半角英小文字・数字・記号</p>
            </div>

            {/* 性別 */}
            <div>
              <p className={labelClass}>GENDER</p>
              <div className="flex gap-2">
                {(["male", "female", "other"] as Gender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={toggleClass(gender === g)}
                  >
                    {g === "male" ? "男性" : g === "female" ? "女性" : "その他"}
                  </button>
                ))}
              </div>
            </div>

            {/* 生年月日 */}
            <div>
              <p className={labelClass}>DATE OF BIRTH</p>
              {/* iOS Safari の input[type=date] は内部表示が枠のCSS幅を超えてはみ出すことがあるため、
                  ネイティブの描画に依存しないプルダウン（年・月・日）で入力させる */}
              <div className="flex gap-2">
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className={`${inputClass} [color-scheme:light]`}
                >
                  <option value="">年</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className={`${inputClass} [color-scheme:light]`}
                >
                  <option value="">月</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className={`${inputClass} [color-scheme:light]`}
                >
                  <option value="">日</option>
                  {DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 紹介コード（任意） */}
            <div>
              <p className={labelClass}>REFERRAL CODE <span className="text-ink-200 normal-case font-dm tracking-normal">（任意）</span></p>
              <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className={inputClass} placeholder="招待コードをお持ちの方" />
            </div>

            <button type="submit" disabled={loading} className="w-full nm-btn-primary text-white font-outfit font-medium py-2.5 disabled:opacity-40 mt-1">
              {loading ? "登録中..." : "登録"}
            </button>
          </form>
        )}
      </div>
    </main>
    <Footer />
    </>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  );
}
