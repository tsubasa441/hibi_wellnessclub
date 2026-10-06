import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { validateNickname } from "@/lib/nameValidation";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`nickname-update:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = await req.json() as { nickname?: string };
  const result = validateNickname(body.nickname);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const nickname = result.value;

  const { error } = await supabase.from("profiles").update({ nickname }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "ニックネームの変更に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ nickname });
}
