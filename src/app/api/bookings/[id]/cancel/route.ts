import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revokeEventPoints, refundUsedPoints } from "@/lib/points";
import { sendCancellationNotification } from "@/lib/email";
import { decrypt } from "@/lib/encrypt";
import { SquareClient, SquareEnvironment } from "square";
import PAYPAY from "@paypayopa/paypayopa-sdk-node";

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
});

PAYPAY.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_PRODUCTION === "true",
});

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const bookingId = params.id;

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, status, payment_method, payment_status, payment_id, points_used, amount_charged, events(start_at, price, title)")
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }

  if (booking.user_id !== user.id) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ error: "既にキャンセル済みです" }, { status: 400 });
  }

  // 2日前チェック
  const eventRaw = booking.events;
  const event = Array.isArray(eventRaw) ? eventRaw[0] : eventRaw as { start_at: string; price: number; title: string } | null;
  if (!event) {
    return NextResponse.json({ error: "イベント情報が取得できません" }, { status: 500 });
  }

  const now = new Date();
  const startAt = new Date(event.start_at);
  const diffDays = (startAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const isRefundable = diffDays >= 2;

  // イベント終了後（開始2時間後以降）はキャンセル不可（参加済みポイントの誤取り消しを防ぐ）
  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + 2);
  if (endAt <= now) {
    return NextResponse.json({ error: "イベントは既に終了しているためキャンセルできません" }, { status: 400 });
  }

  const isPaid = booking.payment_status === "paid";
  const willRefund = isPaid && isRefundable && booking.payment_id != null && (booking.payment_method === "square" || booking.payment_method === "paypay");
  const pointsUsed = booking.points_used ?? 0;
  const willRefundPoints = pointsUsed > 0 && isRefundable;

  // 予約を確定的にキャンセル状態へ遷移（confirmed の場合のみ成功する条件付き更新）。
  // 返金APIを呼ぶ前にここで排他を取ることで、同時に届いた複数リクエストによる二重返金を防ぐ。
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: claimed, error: claimError } = await serviceSupabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .select("id")
    .single();

  if (claimError || !claimed) {
    return NextResponse.json({ error: "既にキャンセル済みです" }, { status: 400 });
  }

  // 返金処理（2日前より後・未決済はスキップ）。返金額は現在の events.price ではなく、
  // 予約確定時に実際に請求した amount_charged を使う（価格改定・ポイント充当との整合性のため）。
  if (willRefund && booking.payment_method === "square") {
    try {
      await squareClient.refunds.refundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId: booking.payment_id!,
        amountMoney: { amount: BigInt(booking.amount_charged), currency: "JPY" },
        reason: "お客様都合によるキャンセル",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Square 返金に失敗しました";
      return NextResponse.json({ error: `予約はキャンセルされましたが、${message}。サポートまでお問い合わせください。` }, { status: 500 });
    }
  }

  if (willRefund && booking.payment_method === "paypay") {
    try {
      await PAYPAY.PaymentRefund([booking.payment_id!, crypto.randomUUID(), booking.amount_charged]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "PayPay 返金に失敗しました";
      return NextResponse.json({ error: `予約はキャンセルされましたが、${message}。サポートまでお問い合わせください。` }, { status: 500 });
    }
  }

  if (willRefund) {
    await serviceSupabase.from("bookings").update({ payment_status: "refunded" }).eq("id", bookingId);
  }

  // 充当していたポイントを払い戻す（現金と同じ2日前ルールが適用される）
  if (willRefundPoints) {
    await refundUsedPoints(supabase, user.id, bookingId);
  }

  // イベント参加ポイントを取り消し（付与済みの場合のみ）
  await revokeEventPoints(supabase, user.id, bookingId);

  // キャンセル通知メール
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  await sendCancellationNotification({
    to: user.email!,
    userName: profile?.name ? decrypt(profile.name) : "ゲスト",
    eventTitle: event.title ?? "",
    startAt: event.start_at,
    price: event.price,
    paymentMethod: (booking.payment_method as "square" | "paypay" | "free") ?? "free",
    refunded: isPaid && isRefundable,
    pointsUsed,
  });

  return NextResponse.json({ success: true });
}
