import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt } from "@/lib/encrypt";
import { getJstParts } from "@/lib/date";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { validateKana, validateName, validateNickname, type NameValidationResult } from "@/lib/nameValidation";
import * as Sentry from "@sentry/nextjs";

// ローマ字変換（kuroshiro）は長音を ō 等のマクロン付き文字で返すため、
// a-z の範囲だけでなく Unicode の文字全般（\p{L}）を許容する
const NAME_ROMAN_REGEX = /^[\p{L}\s　'-]{1,100}$/u;
const BIRTH_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REFERRAL_CODE_REGEX = /^[A-Z0-9]{1,20}$/;
const GENDERS = new Set(["male", "female", "other"]);

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await checkRateLimit(`signup-profile:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = await req.json() as {
    name?: string;
    nameRoman?: string;
    nickname?: string;
    nameKanaSei?: string;
    nameKanaMei?: string;
    gender?: string;
    birthDate?: string;
    referralCode?: string;
  };

  const nameResult = validateName(body.name);
  if (!nameResult.ok) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
  }
  if (body.nameRoman && !NAME_ROMAN_REGEX.test(body.nameRoman.trim())) {
    return NextResponse.json({ error: "nameRoman の形式が正しくありません" }, { status: 400 });
  }
  // 新規登録ではニックネームを入力させず、フリガナのメイを表示名（nickname）にする（2026-10-25）。
  // フリガナを送らない古い画面（デプロイ直後に開いたままの画面）からは、従来どおりニックネームを受け付ける
  let nameKana: string | null = null;
  let nicknameResult: NameValidationResult;
  if (body.nameKanaSei !== undefined || body.nameKanaMei !== undefined) {
    const sei = validateKana(body.nameKanaSei, "セイ");
    if (!sei.ok) return NextResponse.json({ error: sei.error }, { status: 400 });
    const mei = validateKana(body.nameKanaMei, "メイ");
    if (!mei.ok) return NextResponse.json({ error: mei.error }, { status: 400 });
    nameKana = `${sei.value} ${mei.value}`;
    nicknameResult = validateNickname(mei.value);
  } else {
    nicknameResult = validateNickname(body.nickname);
  }
  if (!nicknameResult.ok) {
    return NextResponse.json({ error: nicknameResult.error }, { status: 400 });
  }
  if (!body.gender || !GENDERS.has(body.gender)) {
    return NextResponse.json({ error: "性別の値が正しくありません" }, { status: 400 });
  }
  if (!body.birthDate || !BIRTH_DATE_REGEX.test(body.birthDate)) {
    return NextResponse.json({ error: "生年月日の形式が正しくありません" }, { status: 400 });
  }
  const birthYear = Number(body.birthDate.slice(0, 4));
  if (birthYear < 1900 || birthYear > getJstParts(new Date()).year) {
    return NextResponse.json({ error: "生年月日の年を正しく入力してください" }, { status: 400 });
  }
  if (body.referralCode && !REFERRAL_CODE_REGEX.test(body.referralCode)) {
    return NextResponse.json({ error: "紹介コードの形式が正しくありません" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  updates.name = encrypt(nameResult.value);
  if (body.nameRoman) updates.name_roman = encrypt(body.nameRoman.trim());
  if (nameKana) updates.name_kana = encrypt(nameKana);
  // ニックネームは本人が公開を意図した表示名のため暗号化しない（docs/codingstandards.md参照）
  updates.nickname = nicknameResult.value;
  updates.gender = encrypt(body.gender);
  updates.birth_date = encrypt(body.birthDate);
  if (body.referralCode) updates.referral_code_used = encrypt(body.referralCode);

  // 新規登録の直後に1回だけ保存できる（後から紹介コードを付けたり、氏名・生年月日を書き換えたりさせない）
  const { data: current } = await supabase.from("profiles").select("gender").eq("id", user.id).single();
  if (current?.gender) {
    return NextResponse.json({ error: "プロフィールは登録済みです" }, { status: 409 });
  }

  // profiles は本人から直接更新できない（036）。本人確認済みのここから service_role で書く
  const { error } = await createServiceClient().from("profiles").update(updates).eq("id", user.id);
  if (error) {
    Sentry.captureException(error, { tags: { area: "signup_profile" } });
    return NextResponse.json({ error: "プロフィールの保存に失敗しました" }, { status: 500 });
  }

  // 紹介コードがある場合、referrals レコードを pending で作成する。
  // 200pt の付与は被紹介者が初回イベントにチェックインし、そのイベントが終了した後に
  // ホーム画面ロード時の checkAndAwardReferralReward で確定する（src/lib/referrals.ts）。
  if (body.referralCode) {
    const svc = createServiceClient();

    // 紹介者を特定
    const { data: referrer } = await svc
      .from("profiles")
      .select("id")
      .eq("referral_code", body.referralCode.toUpperCase())
      .single();

    if (referrer) {
      const { data: existing } = await svc
        .from("referrals")
        .select("id")
        .eq("referrer_id", referrer.id)
        .eq("referee_id", user.id)
        .maybeSingle();

      if (!existing) {
        await svc
          .from("referrals")
          .insert({ referrer_id: referrer.id, referee_id: user.id, status: "pending" });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
