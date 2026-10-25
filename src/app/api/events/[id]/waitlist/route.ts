import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { getSeatsLeft } from "@/lib/waitlist";

// キャンセル待ちの登録（POST）・取り消し（DELETE）。満席の公開イベントで、まだ予約していない本人だけが登録できる
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  if (!(await checkRateLimit(`event-waitlist:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  // 一般ユーザーの RLS では公開中のイベントしか取れない
  const { data: event } = await supabase.from("events").select("id, start_at, status").eq("id", id).single();
  if (!event || event.status !== "published") {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }
  if (new Date(event.start_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "開始済みのイベントには登録できません" }, { status: 400 });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (booking) return NextResponse.json({ error: "既に予約済みです" }, { status: 400 });

  const seats = await getSeatsLeft(id);
  if (!seats || seats.left > 0) {
    return NextResponse.json({ error: "空きがあるため、そのまま予約できます" }, { status: 400 });
  }

  const { error } = await createServiceClient()
    .from("event_waitlist")
    .upsert({ event_id: id, user_id: user.id }, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "キャンセル待ちの登録に失敗しました" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  if (!(await checkRateLimit(`event-waitlist:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { error } = await createServiceClient()
    .from("event_waitlist")
    .delete()
    .eq("event_id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "キャンセル待ちの取り消しに失敗しました" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
