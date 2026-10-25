import * as Sentry from "@sentry/nextjs";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWaitlistSeatAvailable } from "@/lib/email";

// 予約の確定数（status = confirmed。PayPay の支払い待ちも席を押さえている）と定員を比べる
export async function getSeatsLeft(eventId: string): Promise<{ capacity: number; booked: number; left: number } | null> {
  const svc = createServiceClient();
  const [{ data: event }, { count }] = await Promise.all([
    svc.from("events").select("capacity").eq("id", eventId).single(),
    svc.from("bookings").select("*", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "confirmed"),
  ]);
  if (!event) return null;
  const booked = count ?? 0;
  return { capacity: event.capacity, booked, left: event.capacity - booked };
}

// 席が空いていれば、キャンセル待ちの全員にメールで知らせ、キャンセル待ちを終了する（2026-10-25）。
// キャンセル・PayPay 未払い予約の解放・定員の変更のあとに呼ぶ。失敗しても呼び出し元の処理は止めない。
// 戻り値は通知した人数
export async function notifyWaitlistIfSeatsOpen(eventId: string): Promise<number> {
  try {
    const svc = createServiceClient();
    const { data: event } = await svc
      .from("events")
      .select("id, title, start_at, status")
      .eq("id", eventId)
      .single();
    if (!event || event.status !== "published" || new Date(event.start_at).getTime() <= Date.now()) return 0;

    const seats = await getSeatsLeft(eventId);
    if (!seats || seats.left <= 0) return 0;

    // 先に行を消してから送る（同時に呼ばれても、同じ人に二重に送らない）
    const { data: entries } = await svc.from("event_waitlist").delete().eq("event_id", eventId).select("user_id");
    if (!entries?.length) return 0;

    let sent = 0;
    for (const { user_id: userId } of entries) {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        svc.auth.admin.getUserById(userId),
        svc.from("profiles").select("nickname").eq("id", userId).single(),
      ]);
      const email = authUser?.user?.email;
      // 退会済み（メールアドレスを置き換え済み）の人には送らない
      if (!email || email.endsWith("@deleted.invalid")) continue;
      await sendWaitlistSeatAvailable({
        to: email,
        userName: profile?.nickname || "ゲスト",
        eventId,
        eventTitle: event.title ?? "",
        startAt: event.start_at,
      });
      sent++;
    }
    return sent;
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "waitlist_notify" }, extra: { eventId } });
    return 0;
  }
}
