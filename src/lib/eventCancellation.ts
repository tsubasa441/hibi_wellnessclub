import { createServiceClient } from "@/lib/supabase/service";
import { refundBookingPayment } from "@/lib/refunds";
import { refundUsedPoints } from "@/lib/points";
import { sendEventCancelledNotification } from "@/lib/email";

// イベントの中止（2026-10-27、依頼者の指定）。確定している予約をすべてキャンセルし、
// 支払い済みの代金は時期を問わず全額返金、充当したポイントも払い戻して、中止のお知らせを送る。
// 返金に失敗した予約があれば failedBookingIds に入れて返す（呼び出し側はイベントを消さずに止める）
export async function cancelEventBookings(eventId: string): Promise<{ cancelled: number; failedBookingIds: string[] }> {
  const svc = createServiceClient();
  const { data: event } = await svc.from("events").select("title, start_at").eq("id", eventId).single();
  const { data: bookings } = await svc
    .from("bookings")
    .select("id, user_id, payment_method, payment_status, payment_id, points_used, amount_charged")
    .eq("event_id", eventId)
    .eq("status", "confirmed");

  let cancelled = 0;
  const failedBookingIds: string[] = [];

  for (const b of bookings ?? []) {
    // 二重に処理しないよう、confirmed のものだけをキャンセルに変える
    const { data: claimed } = await svc
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", b.id)
      .eq("status", "confirmed")
      .select("id");
    if (!claimed?.length) continue;
    cancelled++;

    const isPaid = b.payment_status === "paid";
    let refunded = false;
    if (isPaid && b.amount_charged > 0) {
      const { ok } = await refundBookingPayment({
        bookingId: b.id,
        paymentMethod: b.payment_method,
        paymentId: b.payment_id,
        amountCharged: b.amount_charged,
        reason: "イベント中止のため",
      });
      if (!ok) {
        failedBookingIds.push(b.id);
        continue;
      }
      refunded = true;
      await svc.from("bookings").update({ payment_status: "refunded" }).eq("id", b.id);
    }

    if (b.user_id && (b.points_used ?? 0) > 0) {
      await refundUsedPoints(svc, b.user_id, b.id);
    }

    if (b.user_id && event) {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        svc.auth.admin.getUserById(b.user_id),
        svc.from("profiles").select("nickname").eq("id", b.user_id).single(),
      ]);
      const email = authUser?.user?.email;
      if (email) {
        await sendEventCancelledNotification({
          to: email,
          userName: profile?.nickname || "ゲスト",
          eventTitle: event.title ?? "",
          startAt: event.start_at,
          refundedAmount: refunded ? b.amount_charged : 0,
          pointsRefunded: b.points_used ?? 0,
        });
      }
    }
  }

  return { cancelled, failedBookingIds };
}
