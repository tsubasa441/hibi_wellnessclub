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
// 角丸・枠線なしの白い帯。スマホはページの左右の余白（px-4）を打ち消して画面の端まで広げる（2026-10-24、依頼者の指定）
export default function EventCard({ event, href }: { event: EventCardEvent; href: string }) {
  const label = TYPE_LABELS[event.event_type] ?? event.event_type;

  return (
    <Link
      href={href}
      className="group block bg-white -mx-4 sm:mx-0 px-4 py-5 sm:px-5 hover:bg-base-50 transition"
    >
      <div className="flex items-start gap-4">
        {/* 種別名の長さ（ヨガ〜トレーニング）で右の文字の位置がずれないよう、左の列は幅を固定する */}
        <div className="flex flex-col items-center gap-2 shrink-0 w-[92px]">
          <EventTypeIcon type={event.event_type} label={label} />
          {/* 種別名は枠なしの文字だけ（2026-10-25、依頼者の指定）。列の幅は一番長い「トレーニング」に合わせてある */}
          <span className="w-full text-center text-xs font-noto font-medium whitespace-nowrap text-ink-700">
            {label}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-noto font-semibold text-sm text-ink-700">{formatDateRange(event.start_at, event.end_at)}</p>
          <h3 className="font-noto font-semibold text-lg text-ink-700 leading-snug mt-1">{event.title}</h3>
          <p className="font-noto text-sm text-ink-500 mt-3 flex items-start gap-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px text-ink-700" aria-hidden="true">
              <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <span>{event.location}</span>
          </p>
        </div>
      </div>
      {/* カード全体が詳細へのリンクだと伝わるよう、右下に行き先を示す（2026-10-27、依頼者の指定） */}
      <p className="mt-3 flex items-center justify-end gap-1 font-noto text-sm font-medium text-sage-600">
        詳しく見る
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </p>
    </Link>
  );
}
