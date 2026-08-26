import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt } from "@/lib/encrypt";
import { awardPoints } from "@/lib/points";
import { checkReferralBadges } from "@/lib/badges";

const NAME_REGEX = /^[a-zA-Z぀-ゟ゠-ヿ一-龯･-ﾟ\s　]{1,30}$/;
// ローマ字変換（kuroshiro）は長音を ō 等のマクロン付き文字で返すため、
// a-z の範囲だけでなく Unicode の文字全般（\p{L}）を許容する
const NAME_ROMAN_REGEX = /^[\p{L}\s　'-]{1,100}$/u;
const NICKNAME_REGEX = /^[a-zA-Z0-9぀-ゟ゠-ヿ一-龯･-ﾟ\s　]{1,20}$/;
const BIRTH_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const REFERRAL_CODE_REGEX = /^[A-Z0-9]{1,20}$/;
const GENDERS = new Set(["male", "female", "other"]);

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    nameRoman?: string;
    nickname?: string;
    gender?: string;
    birthDate?: string;
    referralCode?: string;
  };

  if (!body.name || !NAME_REGEX.test(body.name.trim())) {
    return NextResponse.json({ error: "名前の形式が正しくありません" }, { status: 400 });
  }
  if (body.nameRoman && !NAME_ROMAN_REGEX.test(body.nameRoman.trim())) {
    return NextResponse.json({ error: "nameRoman の形式が正しくありません" }, { status: 400 });
  }
  if (!body.nickname || !NICKNAME_REGEX.test(body.nickname.trim())) {
    return NextResponse.json({ error: "ニックネームの形式が正しくありません" }, { status: 400 });
  }
  if (!body.gender || !GENDERS.has(body.gender)) {
    return NextResponse.json({ error: "性別の値が正しくありません" }, { status: 400 });
  }
  if (!body.birthDate || !BIRTH_DATE_REGEX.test(body.birthDate)) {
    return NextResponse.json({ error: "生年月日の形式が正しくありません" }, { status: 400 });
  }
  const birthYear = Number(body.birthDate.slice(0, 4));
  if (birthYear < 1900 || birthYear > new Date().getFullYear()) {
    return NextResponse.json({ error: "生年月日の年を正しく入力してください" }, { status: 400 });
  }
  if (body.referralCode && !REFERRAL_CODE_REGEX.test(body.referralCode)) {
    return NextResponse.json({ error: "紹介コードの形式が正しくありません" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  updates.name = encrypt(body.name.trim());
  if (body.nameRoman) updates.name_roman = encrypt(body.nameRoman.trim());
  // ニックネームは本人が公開を意図した表示名のため暗号化しない（docs/codingstandards.md参照）
  updates.nickname = body.nickname.trim();
  updates.gender = encrypt(body.gender);
  updates.birth_date = encrypt(body.birthDate);
  if (body.referralCode) updates.referral_code_used = encrypt(body.referralCode);

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 紹介コードがある場合、新規登録完了時点でポイントを付与
  if (body.referralCode) {
    const svc = createServiceClient();

    // 紹介者を特定
    const { data: referrer } = await svc
      .from("profiles")
      .select("id")
      .eq("referral_code", body.referralCode.toUpperCase())
      .single();

    if (referrer) {
      // referrals レコードを取得または作成
      let referralId: string | null = null;

      const { data: existing } = await svc
        .from("referrals")
        .select("id, status")
        .eq("referrer_id", referrer.id)
        .eq("referee_id", user.id)
        .single();

      if (existing) {
        referralId = existing.id;
      } else {
        const { data: created } = await svc
          .from("referrals")
          .insert({ referrer_id: referrer.id, referee_id: user.id, status: "pending" })
          .select("id")
          .single();
        referralId = created?.id ?? null;
      }

      if (referralId && existing?.status !== "rewarded") {
        // 紹介者・被紹介者双方に 200pt 付与
        await awardPoints(svc, referrer.id, 200, "referral_reward", referralId);
        await awardPoints(svc, user.id, 200, "referral_joined", referralId);

        // referrals を rewarded に更新
        await svc
          .from("referrals")
          .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
          .eq("id", referralId);

        await checkReferralBadges(svc, referrer.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
