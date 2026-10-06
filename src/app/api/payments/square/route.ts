import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSquareClient } from "@/lib/squareClient";
import { sendBookingConfirmation } from "@/lib/email";
import { decrypt } from "@/lib/encrypt";
import { spendPointsForBooking, refundUsedPoints } from "@/lib/points";
import { getOrCreateCustomerId, saveCard, disableCard, persistSavedCard } from "@/lib/squareCards";
import { buildOptionSelections, EventOptionRow } from "@/lib/eventValidation";
import { checkRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { squareErrorCodes, squareErrorMessage } from "@/lib/squareErrors";
import * as Sentry from "@sentry/nextjs";

const squareClient = getSquareClient();
const PAYMENT_FALLBACK_MESSAGE = "決済を完了できませんでした。時間をおいて再度お試しください。";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  if (!(await checkRateLimit(`payment:${user.id}`, 10, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { eventId, sourceId, pointsToUse, optionSelections, useSavedCard } = await req.json();

  if (!eventId || (!sourceId && !useSavedCard)) {
    return NextResponse.json({ error: "パラメータが不足しています" }, { status: 400 });
  }

  // 重複予約チェック
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .single();

  if (existing) {
    return NextResponse.json({ error: "既に予約済みです" }, { status: 400 });
  }

  // イベント・残席チェック
  const { data: event } = await supabase
    .from("events")
    .select("capacity, price, title, event_type, description, start_at, location, belongings")
    .eq("id", eventId)
    .single();

  // bookings の SELECT RLS は本人の行のみ許可のため、他人の予約も含めた残席数は service_role で数える
  const { count } = await createServiceClient()
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if (!event || (count ?? 0) >= event.capacity) {
    return NextResponse.json({ error: "満席です" }, { status: 400 });
  }

  // 選択項目の回答を検証し、保存用スナップショットを組み立てる（金額には影響しない）
  const { data: eventOptions } = await createServiceClient()
    .from("event_options")
    .select("id, label, choices, multi_select, required, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  const { error: optionError, selections: optionSelectionSnapshot } = buildOptionSelections(
    (eventOptions ?? []) as EventOptionRow[],
    optionSelections
  );
  if (optionError) {
    return NextResponse.json({ error: optionError }, { status: 400 });
  }

  // 無料イベントはSquare決済不要
  if (event.price === 0) {
    const { error } = await supabase.from("bookings").insert({
      event_id: eventId,
      user_id: user.id,
      payment_method: "free",
      payment_status: "paid",
      payment_id: null,
      status: "confirmed",
      option_selections: optionSelectionSnapshot,
    });
    if (error) return NextResponse.json({ error: "予約の作成に失敗しました" }, { status: 500 });

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await sendBookingConfirmation({
      to: user.email!,
      userName: profile?.name ? decrypt(profile.name) : "ゲスト",
      eventTitle: event.title,
      eventType: event.event_type ?? "",
      description: event.description ?? "",
      startAt: event.start_at,
      location: event.location ?? "",
      belongings: event.belongings ?? undefined,
      price: 0,
      paymentMethod: "free",
    });

    return NextResponse.json({ success: true });
  }

  // ポイント充当額（参加費が上限、1pt = 1円）
  const requestedPoints = Math.max(0, Math.min(Math.floor(Number(pointsToUse) || 0), event.price));
  const amountToCharge = event.price - requestedPoints;
  const bookingId = crypto.randomUUID();

  if (requestedPoints > 0) {
    const spent = await spendPointsForBooking(supabase, user.id, requestedPoints, bookingId);
    if (!spent) {
      return NextResponse.json({ error: "ポイント残高が不足しています" }, { status: 400 });
    }
  }

  // ポイントのみで参加費全額を充当した場合はSquare決済不要
  if (amountToCharge === 0) {
    const { error: bookingError } = await supabase.from("bookings").insert({
      id: bookingId,
      event_id: eventId,
      user_id: user.id,
      payment_method: "square",
      payment_status: "paid",
      payment_id: null,
      status: "confirmed",
      points_used: requestedPoints,
      amount_charged: 0,
      option_selections: optionSelectionSnapshot,
    });

    if (bookingError) {
      await refundUsedPoints(supabase, user.id, bookingId);
      return NextResponse.json({ error: "予約の作成に失敗しました" }, { status: 500 });
    }

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await sendBookingConfirmation({
      to: user.email!,
      userName: profile?.name ? decrypt(profile.name) : "ゲスト",
      eventTitle: event.title,
      eventType: event.event_type ?? "",
      description: event.description ?? "",
      startAt: event.start_at,
      location: event.location ?? "",
      belongings: event.belongings ?? undefined,
      price: event.price,
      paymentMethod: "square",
      pointsUsed: requestedPoints,
    });

    return NextResponse.json({ success: true });
  }

  // 保存済みカードの利用・新しいカードの保存（クレジットカード保存機能）
  const { data: cardProfile } = await supabase
    .from("profiles")
    .select("square_customer_id, square_card_id")
    .eq("id", user.id)
    .single();
  const existingCustomerId: string | null = cardProfile?.square_customer_id ?? null;
  const existingCardId: string | null = cardProfile?.square_card_id ?? null;

  let chargeSourceId: string;
  let chargeCustomerId: string;

  if (useSavedCard) {
    if (!existingCardId || !existingCustomerId) {
      if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
      return NextResponse.json({ error: "保存されたカードがありません" }, { status: 400 });
    }
    chargeSourceId = existingCardId;
    chargeCustomerId = existingCustomerId;
  } else {
    try {
      chargeCustomerId = await getOrCreateCustomerId(supabase, user.id, existingCustomerId, user.email ?? null);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: "square_payment", step: "customer" },
        extra: { squareErrorCodes: squareErrorCodes(err) },
      });
      if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
      return NextResponse.json({ error: PAYMENT_FALLBACK_MESSAGE }, { status: 500 });
    }
    // Square 公式の charge-and-store の順序：まずノンスで課金し、成功した決済からカードを保存する。
    // 保存できないカードでも支払い自体は成立させるため、保存は決済成功後に行う
    chargeSourceId = sourceId;
  }

  // Square 決済実行
  try {
    const { payment } = await squareClient.payments.create({
      sourceId: chargeSourceId,
      customerId: chargeCustomerId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: BigInt(amountToCharge),
        currency: "JPY",
      },
      locationId: process.env.SQUARE_LOCATION_ID!,
      note: event.title,
    });

    if (payment?.status !== "COMPLETED") {
      Sentry.captureMessage("Square payment not completed", {
        level: "warning",
        tags: { area: "square_payment", step: "charge" },
        extra: { paymentStatus: payment?.status ?? null },
      });
      if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
      return NextResponse.json({ error: "決済に失敗しました" }, { status: 400 });
    }

    // 予約作成
    const { error: bookingError } = await supabase.from("bookings").insert({
      id: bookingId,
      event_id: eventId,
      user_id: user.id,
      payment_method: "square",
      payment_status: "paid",
      payment_id: payment.id,
      status: "confirmed",
      points_used: requestedPoints,
      amount_charged: amountToCharge,
      option_selections: optionSelectionSnapshot,
    });

    if (bookingError) {
      // 決済成功後に予約作成が失敗した場合、課金・ポイント充当の両方を取り消す
      try {
        await squareClient.refunds.refundPayment({
          idempotencyKey: crypto.randomUUID(),
          paymentId: payment.id!,
          amountMoney: { amount: BigInt(amountToCharge), currency: "JPY" },
          reason: "予約作成失敗による自動返金",
        });
      } catch (refundErr) {
        Sentry.captureException(refundErr, {
          tags: { area: "square_payment", step: "auto_refund" },
          extra: { bookingId, squareErrorCodes: squareErrorCodes(refundErr) },
        });
        return NextResponse.json({ error: "予約の作成に失敗し、返金処理にも失敗しました。サポートまでお問い合わせください。" }, { status: 500 });
      }
      if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
      return NextResponse.json({ error: "予約の作成に失敗したため、決済を取り消しました" }, { status: 500 });
    }

    // 新しいカードで支払った場合のみ、成功した決済からカードを保存する。保存に失敗しても予約は確定済みのため成功として返す
    const cardSaved = useSavedCard
      ? null
      : await saveCardFromPayment(supabase, user.id, chargeCustomerId, payment.id!, existingCardId);

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    await sendBookingConfirmation({
      to: user.email!,
      userName: profile?.name ? decrypt(profile.name) : "ゲスト",
      eventTitle: event.title,
      eventType: event.event_type ?? "",
      description: event.description ?? "",
      startAt: event.start_at,
      location: event.location ?? "",
      belongings: event.belongings ?? undefined,
      price: event.price,
      paymentMethod: "square",
      pointsUsed: requestedPoints,
    });

    return NextResponse.json(cardSaved === null ? { success: true } : { success: true, cardSaved });
  } catch (err) {
    const codes = squareErrorCodes(err);
    Sentry.captureException(err, {
      level: codes.length > 0 ? "warning" : "error",
      tags: { area: "square_payment", step: "charge" },
      extra: { squareErrorCodes: codes, useSavedCard: !!useSavedCard },
    });
    if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
    return NextResponse.json(
      { error: squareErrorMessage(err, PAYMENT_FALLBACK_MESSAGE) },
      { status: codes.length > 0 ? 400 : 500 }
    );
  }
}

// 成功した決済（paymentId）からカードを保存し、古い保存カードを差し替える。失敗は Sentry に記録して false を返す
async function saveCardFromPayment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  customerId: string,
  paymentId: string,
  existingCardId: string | null
): Promise<boolean> {
  try {
    const card = await saveCard(customerId, paymentId);
    await persistSavedCard(supabase, userId, card);
    if (existingCardId && existingCardId !== card.cardId) {
      await disableCard(existingCardId);
    }
    return true;
  } catch (err) {
    Sentry.captureException(err, {
      level: "warning",
      tags: { area: "square_card_save", step: "after_payment" },
      extra: { squareErrorCodes: squareErrorCodes(err) },
    });
    return false;
  }
}
