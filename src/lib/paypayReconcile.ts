import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import PAYPAY from "@paypayopa/paypayopa-sdk-node";
import { createServiceClient } from "@/lib/supabase/service";
import { withPayPayProxy } from "@/lib/paypayProxy";
import { sendBookingConfirmation } from "@/lib/email";
import { refundUsedPoints } from "@/lib/points";
import { decrypt } from "@/lib/encrypt";

PAYPAY.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_PRODUCTION === "true",
});

// PayPay アプリで支払うとサイトへ戻らないことがあり、コールバックが呼ばれず pending のまま残る。
// 未払いのまま席を占有し続けないよう、この時間を過ぎた未払い予約は解放する
export const PENDING_PAYPAY_TTL_MS = 30 * 60 * 1000;

// PayPay が失敗・取消・期限切れと明示した場合だけ TTL で解放する。照会結果が想定外（未知の状態・
// エラー応答）のときは、支払い済みの予約を誤って消すおそれがあるため、より長い猶予を置く
const UNPAID_STATUSES = new Set(["FAILED", "CANCELED", "EXPIRED"]);
export const UNKNOWN_STATUS_TTL_MS = 24 * 60 * 60 * 1000;

type PendingBooking = {
  id: string;
  event_id: string;
  user_id: string;
  points_used: number;
  created_at: string;
};

type User = { id: string; email?: string | null };

async function sendConfirmation(supabase: SupabaseClient, user: User, booking: PendingBooking) {
  if (!user.email) return;

  const { data: event } = await supabase
    .from("events")
    .select("title, event_type, description, start_at, location, price, belongings")
    .eq("id", booking.event_id)
    .single();
  if (!event) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", booking.user_id)
    .single();

  await sendBookingConfirmation({
    to: user.email,
    userName: profile?.name ? decrypt(profile.name) : "ゲスト",
    eventTitle: event.title,
    eventType: event.event_type ?? "",
    description: event.description ?? "",
    startAt: event.start_at,
    location: event.location ?? "",
    belongings: event.belongings ?? undefined,
    price: event.price,
    paymentMethod: "paypay",
    pointsUsed: booking.points_used,
  });
}

async function reconcileOne(supabase: SupabaseClient, user: User, booking: PendingBooking) {
  const details = await withPayPayProxy(() => PAYPAY.GetCodePaymentDetails([booking.id]));
  const body = (details as { BODY?: { data?: { status?: string }; resultInfo?: { code?: string; codeId?: string; message?: string } } })?.BODY;
  const completed = body?.resultInfo?.code === "SUCCESS" && body?.data?.status === "COMPLETED";

  // 書き込みは service_role（bookings に本人向け UPDATE/DELETE の RLS は無い）。
  // payment_status = pending を条件にして、確定済みの予約を消したり二重にメールを送ったりしない
  const service = createServiceClient();

  if (completed) {
    const { data: updated } = await service
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", booking.id)
      .eq("payment_status", "pending")
      .select("id");
    if (updated?.length) await sendConfirmation(supabase, user, booking);
    return;
  }

  const status = body?.data?.status;
  const ageMs = Date.now() - new Date(booking.created_at).getTime();
  // 個人情報を含まない照会結果のみ記録する（Sentry は "code"/"message" キーをマスクするため別名で送る）
  Sentry.captureMessage("PayPay reconcile: payment not completed", {
    level: "info",
    tags: { area: "paypay_reconcile" },
    extra: {
      status,
      paypayResultCode: body?.resultInfo?.code,
      codeId: body?.resultInfo?.codeId,
      paypayResultMessage: body?.resultInfo?.message,
      ageMinutes: Math.round(ageMs / 60000),
    },
  });

  // 未完了でも、支払い途中の可能性があるため猶予内は触らない
  const ttlMs = status && UNPAID_STATUSES.has(status) ? PENDING_PAYPAY_TTL_MS : UNKNOWN_STATUS_TTL_MS;
  if (ageMs < ttlMs) return;

  const { data: removed } = await service
    .from("bookings")
    .delete()
    .eq("id", booking.id)
    .eq("payment_status", "pending")
    .select("id");
  if (removed?.length && booking.points_used > 0) {
    await refundUsedPoints(supabase, booking.user_id, booking.id);
  }
}

// ログイン中ユーザーの pending な PayPay 予約を PayPay に照会し、支払い済みなら確定、
// 期限切れの未払いなら削除してポイントを払い戻す。失敗しても呼び出し元の画面表示は妨げない
export async function reconcilePendingPayPayBookings(
  supabase: SupabaseClient,
  user: User,
  opts: { eventId?: string } = {}
): Promise<void> {
  let query = supabase
    .from("bookings")
    .select("id, event_id, user_id, points_used, created_at")
    .eq("user_id", user.id)
    .eq("payment_method", "paypay")
    .eq("payment_status", "pending")
    .eq("status", "confirmed");
  if (opts.eventId) query = query.eq("event_id", opts.eventId);

  const { data } = await query;

  for (const booking of (data ?? []) as PendingBooking[]) {
    try {
      await reconcileOne(supabase, user, booking);
    } catch (e) {
      Sentry.captureException(e, { tags: { area: "paypay_reconcile" } });
    }
  }
}
