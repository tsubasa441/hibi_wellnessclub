import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { EventInput, validateEventInput } from "@/lib/eventValidation";

export async function POST(req: NextRequest) {
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
    .insert({
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
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ event: data });
}
