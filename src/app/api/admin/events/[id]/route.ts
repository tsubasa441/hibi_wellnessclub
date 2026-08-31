import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { EventInput, validateEventInput } from "@/lib/eventValidation";

function normalizeOptions(options: EventInput["options"]) {
  return (options ?? [])
    .map((o) => ({
      label: (o.label ?? "").trim(),
      choices: (o.choices ?? []).map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean),
      multiSelect: Boolean(o.multiSelect),
      required: Boolean(o.required),
    }))
    .filter((o) => o.label && o.choices.length > 0);
}

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

  // 選択項目は置き換え方式：既存を全削除して再作成する。
  // 既存予約の回答は bookings.option_selections にスナップショット済みのため影響しない。
  const { error: deleteError } = await supabase
    .from("event_options")
    .delete()
    .eq("event_id", params.id);
  if (deleteError) {
    return NextResponse.json({ error: "選択項目の更新に失敗しました" }, { status: 500 });
  }

  const options = normalizeOptions(body.options);
  if (options.length > 0) {
    const { error: optionsError } = await supabase.from("event_options").insert(
      options.map((o, i) => ({
        event_id: params.id,
        label: o.label,
        choices: o.choices,
        multi_select: o.multiSelect,
        required: o.required,
        sort_order: i,
      }))
    );
    if (optionsError) {
      return NextResponse.json({ error: "選択項目の更新に失敗しました" }, { status: 500 });
    }
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
