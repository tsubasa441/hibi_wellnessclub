import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { EventInput, validateEventInput } from "@/lib/eventValidation";
import { notifyWaitlistIfSeatsOpen } from "@/lib/waitlist";
import { cancelEventBookings } from "@/lib/eventCancellation";

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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .eq("id", id)
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
    .eq("event_id", id);
  if (deleteError) {
    return NextResponse.json({ error: "選択項目の更新に失敗しました" }, { status: 500 });
  }

  const options = normalizeOptions(body.options);
  if (options.length > 0) {
    const { error: optionsError } = await supabase.from("event_options").insert(
      options.map((o, i) => ({
        event_id: id,
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

  // 定員を増やして空きが出た場合は、キャンセル待ちの人に知らせる
  await notifyWaitlistIfSeatsOpen(id);

  return NextResponse.json({ event: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .select("id, status, start_at, end_at")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  // イベントは DB から完全に削除する（2026-10-27、依頼者の指定）。予約は 035 で event_id が null になって残るため、
  // 参加回数・参加ポイント・支払いの記録は消えない。終了前のイベントの削除は「中止」として、予約者全員に全額返金する
  const now = Date.now();
  const start = new Date(existing.start_at).getTime();
  const end = existing.end_at ? new Date(existing.end_at).getTime() : start + 2 * 60 * 60 * 1000;
  if (start <= now && now < end) {
    return NextResponse.json({ error: "開催中のイベントは削除できません。終了後に削除してください。" }, { status: 400 });
  }

  let refundedBookings = 0;
  if (end > now) {
    const { cancelled, failedBookingIds } = await cancelEventBookings(id);
    refundedBookings = cancelled;
    if (failedBookingIds.length > 0) {
      // 返金できなかった予約がある間はイベントを消さない（新しい予約は受け付けないよう非公開にする）
      await supabase.from("events").update({ status: "cancelled" }).eq("id", id);
      return NextResponse.json(
        {
          error: `返金できなかった予約が${failedBookingIds.length}件あります。Square・PayPay の管理画面で返金してください（予約ID：${failedBookingIds.join("、")}）。イベントは非公開にしました。`,
          failedBookingIds,
        },
        { status: 500 }
      );
    }
  }

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ success: true, cancelledBookings: refundedBookings });
}
