import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { validateSupportBody } from "@/lib/support";
import { sendSupportInquiryToAdmin } from "@/lib/email";

// ユーザーが運営へお問い合わせを送る。保存後、運営（hibi.wellnessclub@gmail.com）へメールで通知する
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`support-message:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const json = (await req.json()) as { body?: unknown };
  const result = validateSupportBody(json.body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // support_messages は本人も含め書き込みのポリシーが無いため、本人確認済みの上で service_role で書く
  const service = createServiceClient();
  const { data: message, error } = await service
    .from("support_messages")
    .insert({ user_id: user.id, sender: "user", body: result.value })
    .select("id, sender, body, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "送信に失敗しました。時間をおいて、もう一度お試しください。" }, { status: 500 });
  }

  const { data: profile } = await service.from("profiles").select("nickname").eq("id", user.id).single();
  await sendSupportInquiryToAdmin({
    userId: user.id,
    userName: profile?.nickname || "ユーザー",
    body: result.value,
  });

  return NextResponse.json({ message });
}
