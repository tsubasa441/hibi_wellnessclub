import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendBookingConfirmation } from "@/lib/email";
import { checkRankUp } from "@/lib/ranks";
import { checkEventBadges } from "@/lib/badges";
import { refundUsedPoints } from "@/lib/points";
import PAYPAY from "@paypayopa/paypayopa-sdk-node";
import { decrypt } from "@/lib/encrypt";

PAYPAY.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_PRODUCTION === "true",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const merchantPaymentId = searchParams.get("merchantPaymentId");

  if (!merchantPaymentId) {
    return NextResponse.redirect(
      new URL("/home?payment=error", req.url)
    );
  }

  const supabase = createClient();

  // 予約情報取得
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, event_id, user_id, payment_status, points_used")
    .eq("id", merchantPaymentId)
    .single();

  if (!booking) {
    return NextResponse.redirect(new URL("/home?payment=error", req.url));
  }

  // 既に支払い済みの場合はそのままリダイレクト
  if (booking.payment_status === "paid") {
    return NextResponse.redirect(
      new URL(`/events/${booking.event_id}?booked=1`, req.url)
    );
  }

  // PayPay決済状況を確認
  let paymentDetails: unknown;
  try {
    paymentDetails = await PAYPAY.GetPaymentDetails([merchantPaymentId]);
  } catch {
    return NextResponse.redirect(new URL("/home?payment=error", req.url));
  }

  const detailBody = (paymentDetails as { BODY?: { data?: { status?: string }; resultInfo?: { code?: string } } })?.BODY;
  const resultCode = detailBody?.resultInfo?.code;
  const paymentStatus = detailBody?.data?.status;

  if (resultCode !== "SUCCESS" || paymentStatus !== "COMPLETED") {
    // 決済未完了 or キャンセル → pending予約を削除し、充当していたポイントも払い戻す
    await supabase.from("bookings").delete().eq("id", booking.id);
    if (booking.points_used > 0) {
      await refundUsedPoints(supabase, booking.user_id, booking.id);
    }
    return NextResponse.redirect(
      new URL(`/events/${booking.event_id}?payment=cancelled`, req.url)
    );
  }

  // 予約を確定
  await supabase
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", booking.id);

  // ポイント・ランク処理・メール送信
  const { data: event } = await supabase
    .from("events")
    .select("title, event_type, description, start_at, location, price")
    .eq("id", booking.event_id)
    .single();

  const { data: userAuth } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", booking.user_id)
    .single();

  await checkRankUp(supabase, booking.user_id);
  await checkEventBadges(createServiceClient(), booking.user_id);

  if (event && userAuth.user?.email) {
    await sendBookingConfirmation({
      to: userAuth.user.email,
      userName: profile?.name ? decrypt(profile.name) : "ゲスト",
      eventTitle: event.title,
      eventType: event.event_type ?? "",
      description: event.description ?? "",
      startAt: event.start_at,
      location: event.location ?? "",
      price: event.price,
      paymentMethod: "paypay",
      pointsUsed: booking.points_used,
    });
  }

  return NextResponse.redirect(
    new URL(`/events/${booking.event_id}?booked=1`, req.url)
  );
}
