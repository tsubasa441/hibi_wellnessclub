import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkEventBadges } from "@/lib/badges";
import { checkRankUp } from "@/lib/ranks";
import { spendPointsForBooking, refundUsedPoints } from "@/lib/points";
import { sendBookingConfirmation } from "@/lib/email";
import { decrypt } from "@/lib/encrypt";
import PAYPAY from "@paypayopa/paypayopa-sdk-node";

PAYPAY.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_PRODUCTION === "true",
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { eventId, pointsToUse } = await req.json();

  if (!eventId) {
    return NextResponse.json({ error: "イベントIDが必要です" }, { status: 400 });
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

  // 残席チェック
  const { data: event } = await supabase
    .from("events")
    .select("capacity, price, title, event_type, description, start_at, location, belongings")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
  }

  // bookings の SELECT RLS は本人の行のみ許可のため、他人の予約も含めた残席数は service_role で数える
  const { count } = await createServiceClient()
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  if ((count ?? 0) >= event.capacity) {
    return NextResponse.json({ error: "満席です" }, { status: 400 });
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

  // pending予約を作成
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      id: bookingId,
      event_id: eventId,
      user_id: user.id,
      payment_method: "paypay",
      payment_status: "pending",
      payment_id: "",
      status: "confirmed",
      points_used: requestedPoints,
      amount_charged: amountToCharge,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
    return NextResponse.json({ error: "予約の作成に失敗しました" }, { status: 500 });
  }

  // 参加費全額をポイントで充当した場合・無料イベントの場合はPayPay決済不要
  if (amountToCharge === 0) {
    await supabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", booking.id);

    await checkRankUp(supabase, user.id);
    await checkEventBadges(createServiceClient(), user.id);

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
      paymentMethod: "paypay",
      pointsUsed: requestedPoints,
    });

    return NextResponse.json({ success: true, redirectUrl: `/events/${eventId}?booked=1` });
  }

  // PayPay QRコード決済作成
  const merchantPaymentId = booking.id;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const callbackUrl = `${siteUrl}/api/payments/paypay/callback?merchantPaymentId=${merchantPaymentId}`;

  const payload = {
    merchantPaymentId,
    amount: { amount: amountToCharge, currency: "JPY" },
    codeType: "ORDER_QR",
    redirectUrl: callbackUrl,
    redirectType: "WEB_LINK",
    orderDescription: event.title,
    orderItems: [
      {
        name: event.title,
        category: "EVENT",
        quantity: 1,
        productId: eventId,
        unitPrice: { amount: amountToCharge, currency: "JPY" },
      },
    ],
  };

  let paypayResponse: unknown;
  try {
    paypayResponse = await PAYPAY.QRCodeCreate(payload);
  } catch {
    // PayPay API エラー時は pending 予約を削除
    await supabase.from("bookings").delete().eq("id", booking.id);
    if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
    return NextResponse.json({ error: "PayPay決済の開始に失敗しました" }, { status: 500 });
  }

  const body = (paypayResponse as { BODY?: { data?: { url?: string }; resultInfo?: { code?: string } } })?.BODY;
  const resultCode = body?.resultInfo?.code;
  const paymentUrl = body?.data?.url;

  if (resultCode !== "SUCCESS" || !paymentUrl) {
    await supabase.from("bookings").delete().eq("id", booking.id);
    if (requestedPoints > 0) await refundUsedPoints(supabase, user.id, bookingId);
    return NextResponse.json({ error: "PayPay決済URLの取得に失敗しました" }, { status: 500 });
  }

  // payment_id にmerchantPaymentId を保存
  await supabase
    .from("bookings")
    .update({ payment_id: merchantPaymentId })
    .eq("id", booking.id);

  return NextResponse.json({ redirectUrl: paymentUrl });
}
