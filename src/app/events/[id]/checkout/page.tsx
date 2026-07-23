import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "./CheckoutForm";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: event }, { count: bookedCount }, { data: profile }] = await Promise.all([
    supabase.from("events").select("*").eq("id", params.id).single(),
    supabase.from("bookings").select("*", { count: "exact", head: true }).eq("event_id", params.id).eq("status", "confirmed"),
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
              const y = d.getFullYear();
              const m = String(d.getMonth()+1).padStart(2,"0");
              const day = String(d.getDate()).padStart(2,"0");
              const h = d.getHours(); const mi = String(d.getMinutes()).padStart(2,"0");
              const start = `${h%12||12}:${mi} ${h<12?"AM":"PM"}`;
              if (event.end_at) {
                const e = new Date(event.end_at);
                const eh = e.getHours(); const emi = String(e.getMinutes()).padStart(2,"0");
                const end = `${eh%12||12}:${emi} ${eh<12?"AM":"PM"}`;
                return `${y}/${m}/${day}（${DAYS[d.getDay()]}） ${start} 〜 ${end}`;
              }
              return `${y}/${m}/${day}（${DAYS[d.getDay()]}） ${start}`;
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
