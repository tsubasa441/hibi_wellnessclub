import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { getOrCreateCustomerId, saveCard, disableCard, persistSavedCard } from "@/lib/squareCards";

// 設定画面からのクレジットカード登録・変更（決済を伴わない）
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`card-update:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { sourceId } = await req.json() as { sourceId?: string };
  if (!sourceId) {
    return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("square_customer_id, square_card_id")
    .eq("id", user.id)
    .single();
  const existingCustomerId: string | null = profile?.square_customer_id ?? null;
  const existingCardId: string | null = profile?.square_card_id ?? null;

  try {
    const customerId = await getOrCreateCustomerId(supabase, user.id, existingCustomerId, user.email ?? null);
    const card = await saveCard(customerId, sourceId);
    await persistSavedCard(supabase, user.id, card);
    if (existingCardId && existingCardId !== card.cardId) {
      await disableCard(existingCardId);
    }
    return NextResponse.json({ brand: card.brand, last4: card.last4, expMonth: card.expMonth, expYear: card.expYear });
  } catch (err) {
    const message = err instanceof Error ? err.message : "カードの保存に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 登録済みカードの削除
export async function DELETE() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`card-update:${user.id}`, 5, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("square_card_id")
    .eq("id", user.id)
    .single();
  const existingCardId: string | null = profile?.square_card_id ?? null;

  if (!existingCardId) {
    return NextResponse.json({ error: "登録されたカードがありません" }, { status: 400 });
  }

  await disableCard(existingCardId);
  await persistSavedCard(supabase, user.id, null);

  return NextResponse.json({ success: true });
}
