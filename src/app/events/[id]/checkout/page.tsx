import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import CheckoutForm from "./CheckoutForm";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import { getJstParts } from "@/lib/date";

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // bookings の SELECT RLS は本人の行のみ許可のため、他人の予約も含めた残席数は service_role で数える
  const [{ data: event }, { count: bookedCount }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").eq("id", params.id).single(),
    createServiceClient().from("bookings").select("*", { count: "exact", head: true }).eq("event_id", params.id).eq("status", "confirmed"),
    supabase.from("profiles").select("points").eq("id", user.id).single(),
  ]);

  if (!event) notFound();

  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("id")
    .eq("event_id", params.id)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .single();

  if (existingBooking) redirect(`/events/${params.id}`);

  const remaining = event.capacity - (bookedCount ?? 0);
  if (remaining <= 0) redirect(`/events/${params.id}`);

  return (
    <main className="relative min-h-screen app-bg pb-24">
      <Header />

      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="font-outfit text-2xl font-semibold text-ink-700 mb-6 animate-fade-up animate-delay-100">予約・お支払い</h1>

        <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(44,53,49,0.08)] p-5 mb-6 animate-fade-up animate-delay-200">
          <p className="font-outfit text-xs text-ink-300 mb-1">予約するイベント</p>
          <p className="font-outfit font-semibold text-lg text-ink-700">{event.title}</p>
          <p className="font-dm text-sm text-ink-300 mt-1">
            {(() => {
              const DAYS = ["日","月","火","水","木","金","土"];
              const d = new Date(event.start_at);
              const { year: y, month: mo, day: dayNum, hours: h, minutes: mi, dayOfWeek } = getJstParts(d);
              const m = String(mo).padStart(2,"0");
              const day = String(dayNum).padStart(2,"0");
              const min = String(mi).padStart(2,"0");
              const start = `${h%12||12}:${min} ${h<12?"AM":"PM"}`;
              if (event.end_at) {
                const e = new Date(event.end_at);
                const { hours: eh, minutes: emiNum } = getJstParts(e);
                const emi = String(emiNum).padStart(2,"0");
                const end = `${eh%12||12}:${emi} ${eh<12?"AM":"PM"}`;
                return `${y}/${m}/${day}（${DAYS[dayOfWeek]}） ${start} 〜 ${end}`;
              }
              return `${y}/${m}/${day}（${DAYS[dayOfWeek]}） ${start}`;
            })()}
          </p>
          <p className="font-dm text-sm text-ink-300">{event.location}</p>
          <div className="mt-4 pt-4 border-t border-base-200 flex justify-between items-center">
            <span className="font-dm text-ink-500">お支払い金額</span>
            <span className="font-outfit text-2xl font-bold text-ink-700">
              ¥{event.price.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-base-100 border border-sage-200 rounded-xl p-4 mb-6 text-sm text-ink-700">
          <p className="font-outfit font-semibold mb-1">キャンセルポリシー</p>
          <ul className="font-dm space-y-0.5">
            <li>・イベント当日までキャンセル可能です</li>
            <li>・2日前まで：全額返金</li>
            <li>・前日・当日：返金対象外（キャンセル料100%）</li>
            <li>・悪天候等による中止：時期を問わず全額返金</li>
          </ul>
        </div>

        <CheckoutForm
          event={event}
          userId={user.id}
          locationId={process.env.SQUARE_LOCATION_ID!}
          pointsBalance={profile?.points ?? 0}
        />
      </div>
      <BottomNav />
    </main>
  );
}
