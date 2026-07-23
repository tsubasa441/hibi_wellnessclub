import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardJournalPoints } from "@/lib/points";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const { mood, energy, note } = await req.json();
  if (!mood || !energy) return NextResponse.json({ error: "気分と体調は必須です" }, { status: 400 });

  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabase
    .from("journals")
    .upsert({ user_id: user.id, recorded_at: today, mood, energy, note: note ?? null }, { onConflict: "user_id,recorded_at" });

  if (error) return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });

  const { awarded } = await awardJournalPoints(supabase, user.id, today);

  return NextResponse.json({ success: true, pointsAwarded: awarded ? 3 : 0 });
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("journals")
    .select("*")
    .eq("user_id", user.id)
    .eq("recorded_at", today)
    .single();

  return NextResponse.json({ journal: data });
}
