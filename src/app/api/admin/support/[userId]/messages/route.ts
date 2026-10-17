import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdmin } from "@/lib/admin";
import { validateSupportBody } from "@/lib/support";
import { sendSupportReplyToUser } from "@/lib/email";

// 運営がユーザーのお問い合わせに返信する。保存後、ユーザーへ「返信があります」とメールで知らせる
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const json = (await req.json()) as { body?: unknown };
  const result = validateSupportBody(json.body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("id, nickname").eq("id", userId).maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  const { data: message, error } = await service
    .from("support_messages")
    .insert({ user_id: userId, sender: "admin", body: result.value })
    .select("id, sender, body, created_at")
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  // 退会済み（メールが deleted-…@deleted.invalid に置き換え済み）のユーザーには送らない
  const { data: authUser } = await service.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (email && !email.endsWith("@deleted.invalid")) {
    await sendSupportReplyToUser({ to: email, userName: profile.nickname || "ユーザー" });
  }

  return NextResponse.json({ message });
}
