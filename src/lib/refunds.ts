import * as Sentry from "@sentry/nextjs";
import { SquareClient, SquareEnvironment } from "square";
import PAYPAY from "@paypayopa/paypayopa-sdk-node";
import { withPayPayProxy } from "@/lib/paypayProxy";

const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN!,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});

PAYPAY.Configure({
  clientId: process.env.PAYPAY_CLIENT_ID!,
  clientSecret: process.env.PAYPAY_CLIENT_SECRET!,
  merchantId: process.env.PAYPAY_MERCHANT_ID!,
  productionMode: process.env.PAYPAY_PRODUCTION === "true",
});

export type RefundTarget = {
  bookingId: string;
  paymentMethod: string | null;
  paymentId: string | null;
  amountCharged: number;
  reason: string;
};

// 支払い済みの予約の代金を、Square / PayPay に全額返金する。失敗しても例外は投げず、結果を返す
// （イベントの中止で使う。予約者本人のキャンセルは /api/bookings/[id]/cancel が同じ手順で行う）
export async function refundBookingPayment(t: RefundTarget): Promise<{ ok: boolean }> {
  if (!t.paymentId || t.amountCharged <= 0) return { ok: true };
  try {
    if (t.paymentMethod === "square") {
      await squareClient.refunds.refundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId: t.paymentId,
        amountMoney: { amount: BigInt(t.amountCharged), currency: "JPY" },
        reason: t.reason,
      });
      return { ok: true };
    }
    if (t.paymentMethod === "paypay") {
      // 返金には PayPay 側の paymentId が必要（bookings.payment_id は加盟店側の merchantPaymentId）
      const details = await withPayPayProxy(() => PAYPAY.GetCodePaymentDetails([t.paymentId!]));
      const detailsBody = (details as { BODY?: { data?: { paymentId?: string } } })?.BODY;
      const paypayPaymentId = detailsBody?.data?.paymentId;
      if (!paypayPaymentId) throw new Error("PayPay paymentId not found");
      const refund = await withPayPayProxy(() =>
        PAYPAY.PaymentRefund({
          merchantRefundId: crypto.randomUUID(),
          paymentId: paypayPaymentId,
          amount: { amount: t.amountCharged, currency: "JPY" },
          reason: t.reason,
        })
      );
      const code = (refund as { BODY?: { resultInfo?: { code?: string } } })?.BODY?.resultInfo?.code;
      if (code !== "SUCCESS") throw new Error(`PayPay refund result: ${code}`);
      return { ok: true };
    }
    return { ok: true };
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: "event_cancel_refund", payment_method: t.paymentMethod ?? "unknown" },
      extra: { bookingId: t.bookingId, amountCharged: t.amountCharged },
    });
    return { ok: false };
  }
}
