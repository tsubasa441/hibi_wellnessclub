import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { EventInput, validateEventInput } from "@/lib/eventValidation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = (await req.json()) as EventInput;
  const validationError = validateEventInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("events")
    .update({
      title: body.title!.trim(),
      description: body.description?.trim() || null,
      event_type: body.eventType,
      start_at: body.startAt,
      end_at: body.endAt,
      location: body.location!.trim(),
      meeting_place: body.meetingPlace?.trim() || null,
      remarks: body.remarks?.trim() || null,
      belongings: body.belongings?.trim() || null,
      capacity: body.capacity,
      price: body.price,
      status: body.status,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }
  if (!(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }
  if (existing.status === "cancelled") {
    return NextResponse.json({ error: "既に削除済みです" }, { status: 400 });
  }

  // 物理削除はしない（bookings.event_id が on delete cascade のため、
  // イベントを消すと紐づく予約履歴・決済履歴まで巻き添えで失われる）
  const { error } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
