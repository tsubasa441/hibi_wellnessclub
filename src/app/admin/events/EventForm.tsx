"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const inputClass = "w-full bg-base-50 border border-base-200 text-ink-700 placeholder-ink-200 font-dm text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-ink-300 transition";
const labelClass = "font-outfit text-xs text-sage-500 font-medium tracking-widest mb-1.5 block";

const EVENT_TYPE_OPTIONS = [
  { value: "yoga", label: "ヨガ" },
  { value: "training", label: "トレーニング" },
  { value: "running", label: "ランニング" },
  { value: "boxing", label: "ボクシング" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "published", label: "公開" },
  { value: "cancelled", label: "キャンセル" },
];

type EventRecord = {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_at: string;
  end_at: string;
  location: string;
  meeting_place: string | null;
  remarks: string | null;
  capacity: number;
  price: number;
  status: string;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventForm({
  mode,
  initialEvent,
}: {
  mode: "create" | "edit";
  initialEvent?: EventRecord;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [eventType, setEventType] = useState(initialEvent?.event_type ?? "yoga");
  const [startAt, setStartAt] = useState(initialEvent ? toLocalInputValue(initialEvent.start_at) : "");
  const [endAt, setEndAt] = useState(initialEvent ? toLocalInputValue(initialEvent.end_at) : "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [meetingPlace, setMeetingPlace] = useState(initialEvent?.meeting_place ?? "");
  const [remarks, setRemarks] = useState(initialEvent?.remarks ?? "");
  const [capacity, setCapacity] = useState(initialEvent?.capacity ?? 20);
  const [price, setPrice] = useState(initialEvent?.price ?? 0);
  const [status, setStatus] = useState(initialEvent?.status ?? "draft");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      title,
      description,
      eventType,
      startAt: startAt ? new Date(startAt).toISOString() : "",
      endAt: endAt ? new Date(endAt).toISOString() : "",
      location,
      meetingPlace,
      remarks,
      capacity: Number(capacity),
      price: Number(price),
      status,
    };

    try {
      const url = mode === "create" ? "/api/admin/events" : `/api/admin/events/${initialEvent!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "保存に失敗しました");
        setLoading(false);
        return;
      }
      router.push("/admin/events");
      router.refresh();
    } catch {
      setError("保存に失敗しました");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-600 font-dm text-sm rounded-lg px-4 py-3">{error}</div>}

      <div>
        <label className={labelClass}>タイトル</label>
        <input
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={100}
        />
      </div>

      <div>
        <label className={labelClass}>説明</label>
        <textarea
          className={inputClass}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
        />
      </div>

      <div>
        <label className={labelClass}>種別</label>
        <select className={inputClass} value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {EVENT_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>開始日時</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass}>終了日時</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>開催場所</label>
        <input
          className={inputClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          maxLength={200}
        />
      </div>

      <div>
        <label className={labelClass}>集合場所</label>
        <input
          className={inputClass}
          value={meetingPlace}
          onChange={(e) => setMeetingPlace(e.target.value)}
          maxLength={200}
          placeholder="任意（例：公園入口の噴水前）"
        />
      </div>

      <div>
        <label className={labelClass}>備考</label>
        <textarea
          className={inputClass}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="任意（例：雨天時は中止、持ち物など）"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>定員</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            className={inputClass}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className={labelClass}>価格（円）</label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>ステータス</label>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-sage-500 text-white font-outfit font-medium py-3 rounded-full hover:bg-sage-600 transition disabled:opacity-60"
      >
        {loading ? "保存中..." : mode === "create" ? "作成する" : "更新する"}
      </button>
    </form>
  );
}
