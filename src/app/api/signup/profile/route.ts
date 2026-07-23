import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt } from "@/lib/encrypt";
import { awardPoints } from "@/lib/points";
import { checkReferralBadges } from "@/lib/badges";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name?: string;
    nameRoman?: string;
    gender?: string;
    birthDate?: string;
    referralCode?: string;
  };

  const updates: Record<string, string> = {};
  if (body.name) updates.name = encrypt(body.name);
  if (body.nameRoman) updates.name_roman = encrypt(body.nameRoman);
  if (body.gender) updates.gender = encrypt(body.gender);
  if (body.birthDate) updates.birth_date = encrypt(body.birthDate);
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
