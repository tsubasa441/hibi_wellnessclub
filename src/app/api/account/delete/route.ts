import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { encrypt } from "@/lib/encrypt";
import { randomUUID } from "crypto";

// 匿名化後の氏名。profiles.name / name_roman は NOT NULL 制約があるため null にはできず、
// 他の氏名カラム同様「暗号文が入っている」前提のコード（管理者一覧・CSV の decrypt 等）を
// 壊さないよう、個人情報を含まないプレースホルダを暗号化して入れる。
const ANONYMIZED_NAME = "退会済みユーザー";

// アカウント削除：氏名・性別・生年月日・メールアドレス等の個人情報のみ匿名化し、
// 予約・決済・ポイント履歴等は user_id を保持したまま残す（会計上の記録、および
// 自分が紹介した相手の紹介実績表示に影響を与えないため）。auth.users の行自体は
// 削除しない（profiles.id が auth.users(id) on delete cascade のため、削除すると
// bookings 等の履歴も連鎖的に消えてしまう）。ログイン自体は ban_duration で無効化する。
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`account-delete:${user.id}`, 3, 300))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_admin) {
    return NextResponse.json(
      { error: "管理者アカウントはこの画面から削除できません。運営にご連絡ください。" },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  const { error: profileError } = await service
    .from("profiles")
    .update({
      name: encrypt(ANONYMIZED_NAME),
      name_roman: encrypt(ANONYMIZED_NAME),
      nickname: ANONYMIZED_NAME,
      gender: null,
      birth_date: null,
      referral_code_used: null,
      avatar_url: null,
    })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: "アカウントの削除に失敗しました" }, { status: 500 });
  }

  // auth.users も、パスワード・メールアドレス（＝ログインに使える個人情報）を無効化した上で
  // 実質的に永久ログイン不可にする（Supabaseの ban_duration は無期限指定ができないため、
  // 十分に長い期間を指定する慣例に従う）
  const { error: authError } = await service.auth.admin.updateUserById(user.id, {
    email: `deleted-${user.id}@deleted.invalid`,
    password: randomUUID() + randomUUID(),
    ban_duration: "876000h",
    user_metadata: {},
  });

  if (authError) {
    return NextResponse.json(
      { error: "個人情報の匿名化は完了しましたが、ログイン無効化処理に失敗しました。運営にご連絡ください。" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
