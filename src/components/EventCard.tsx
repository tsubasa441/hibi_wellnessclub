import Link from "next/link";
import EventTypeIcon from "@/components/EventTypeIcon";
import { getJstParts } from "@/lib/date";

const TYPE_LABELS: Record<string, string> = {
  yoga: "ヨガ",
  training: "トレーニング",
  running: "ランニング",
  boxing: "ボクシング",
  pilates: "ピラティス",
};

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export type EventCardEvent = {
  title: string;
  start_at: string;
  end_at: string | null;
  location: string;
  event_type: string;
};

function formatTime(d: Date) {
  const { hours, minutes } = getJstParts(d);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

// 例: 2026/11/10(火) 16:00 - 17:00（終了時刻が無ければ開始時刻のみ）
function formatDateRange(startStr: string, endStr: string | null) {
  const start = new Date(startStr);
  const { year, month, day, dayOfWeek } = getJstParts(start);
  const date = `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}(${DAYS[dayOfWeek]})`;
  const time = endStr ? `${formatTime(start)} - ${formatTime(new Date(endStr))}` : formatTime(start);
  return `${date} ${time}`;
}

// イベント一覧・ホームで共通のイベントカード（日時・イベント名・開催場所、アイコンの下に種別）
export default function EventCard({ event, href }: { event: EventCardEvent; href: string }) {
  const label = TYPE_LABELS[event.event_type] ?? event.event_type;

  return (
    <Link
      href={href}
      className="block bg-white border border-base-200 rounded-2xl p-5 hover:border-sage-300 transition"
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <EventTypeIcon type={event.event_type} label={label} />
          <span className="inline-flex items-center text-xs font-noto font-medium px-3 py-1 rounded-full whitespace-nowrap bg-sage-100 text-ink-700">
            {label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-noto font-bold text-sm text-ink-700">{formatDateRange(event.start_at, event.end_at)}</p>
          <h3 className="font-noto font-bold text-lg text-ink-700 leading-snug mt-1">{event.title}</h3>
          <p className="font-noto text-sm text-ink-500 mt-3 flex items-start gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px text-ink-700" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span>{event.location}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
