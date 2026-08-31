"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toJstDateTimeLocal, fromJstDateTimeLocal } from "@/lib/date";
import { MAX_EVENT_OPTIONS } from "@/lib/eventValidation";

const inputClass = "w-full bg-base-50 border border-base-200 text-ink-700 placeholder-ink-200 font-dm text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:border-ink-300 transition";
const labelClass = "font-outfit text-xs text-sage-500 font-medium tracking-widest mb-1.5 block";

const EVENT_TYPE_OPTIONS = [
  { value: "yoga", label: "ヨガ" },
  { value: "training", label: "トレーニング" },
  { value: "running", label: "ランニング" },
  { value: "boxing", label: "ボクシング" },
  { value: "pilates", label: "ピラティス" },
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
  belongings: string | null;
  capacity: number;
  price: number;
  status: string;
};

type EventOptionRecord = {
  id: string;
  label: string;
  choices: string[];
  multi_select: boolean;
  required: boolean;
  sort_order: number;
};

type OptionFormState = {
  label: string;
  choicesText: string;
  multiSelect: boolean;
  required: boolean;
};

export default function EventForm({
  mode,
  initialEvent,
  initialOptions,
}: {
  mode: "create" | "edit";
  initialEvent?: EventRecord;
  initialOptions?: EventOptionRecord[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [eventType, setEventType] = useState(initialEvent?.event_type ?? "yoga");
  const [startAt, setStartAt] = useState(initialEvent ? toJstDateTimeLocal(initialEvent.start_at) : "");
  const [endAt, setEndAt] = useState(initialEvent ? toJstDateTimeLocal(initialEvent.end_at) : "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [meetingPlace, setMeetingPlace] = useState(initialEvent?.meeting_place ?? "");
  const [remarks, setRemarks] = useState(initialEvent?.remarks ?? "");
  const [belongings, setBelongings] = useState(initialEvent?.belongings ?? "");
  const [capacity, setCapacity] = useState(initialEvent ? String(initialEvent.capacity) : "");
  const [price, setPrice] = useState(initialEvent ? String(initialEvent.price) : "");
  const [status, setStatus] = useState(initialEvent?.status ?? "draft");
  const [options, setOptions] = useState<OptionFormState[]>(
    (initialOptions ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((o) => ({
        label: o.label,
        choicesText: o.choices.join("\n"),
        multiSelect: o.multi_select,
        required: o.required,
      }))
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateOption(index: number, patch: Partial<OptionFormState>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOption() {
    setOptions((prev) =>
      prev.length >= MAX_EVENT_OPTIONS
        ? prev
        : [...prev, { label: "", choicesText: "", multiSelect: false, required: false }]
    );
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      title,
      description,
      eventType,
      startAt: startAt ? fromJstDateTimeLocal(startAt) : "",
      endAt: endAt ? fromJstDateTimeLocal(endAt) : "",
      location,
      meetingPlace,
      remarks,
      belongings,
      capacity: capacity === "" ? NaN : Number(capacity),
      price: price === "" ? NaN : Number(price),
      status,
      options: options.map((o) => ({
        label: o.label.trim(),
        choices: o.choicesText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        multiSelect: o.multiSelect,
        required: o.required,
      })),
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

      <div>
        <label className={labelClass}>持ち物</label>
        <textarea
          className={inputClass}
          value={belongings}
          onChange={(e) => setBelongings(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="任意（例：タオル、水筒、ヨガマット）"
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
            onChange={(e) => setCapacity(e.target.value)}
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
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="border border-base-200 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-outfit text-sm font-medium text-ink-700">選択項目（任意）</p>
            <p className="font-dm text-xs text-ink-300 mt-0.5">
              参加者に予約前に選んでもらう項目。金額には影響しません。
            </p>
          </div>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= MAX_EVENT_OPTIONS}
            className="shrink-0 border border-ink-300 text-ink-500 font-outfit text-xs font-medium px-3 py-1.5 rounded-full hover:bg-base-100 transition disabled:opacity-40"
          >
            項目を追加
          </button>
        </div>

        {options.length === 0 && (
          <p className="font-dm text-xs text-ink-300">選択項目はありません。</p>
        )}

        {options.map((option, index) => (
          <div key={index} className="border border-base-200 rounded-lg p-3 space-y-3 bg-base-50">
            <div className="flex items-center justify-between gap-3">
              <span className="font-outfit text-xs text-ink-300">項目 {index + 1}</span>
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="font-outfit text-xs text-red-500 hover:text-red-600 transition"
              >
                この項目を削除
              </button>
            </div>

            <div>
              <label className={labelClass}>項目名</label>
              <input
                className={inputClass}
                value={option.label}
                onChange={(e) => updateOption(index, { label: e.target.value })}
                maxLength={50}
                placeholder="例：Tシャツサイズ"
              />
            </div>

            <div>
              <label className={labelClass}>選択肢（1行に1つ）</label>
              <textarea
                className={inputClass}
                value={option.choicesText}
                onChange={(e) => updateOption(index, { choicesText: e.target.value })}
                rows={3}
                placeholder={"S\nM\nL"}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 font-dm text-sm text-ink-500">
                <input
                  type="checkbox"
                  className="accent-ink-500"
                  checked={option.multiSelect}
                  onChange={(e) => updateOption(index, { multiSelect: e.target.checked })}
                />
                複数選択を許可する
              </label>
              <label className="flex items-center gap-2 font-dm text-sm text-ink-500">
                <input
                  type="checkbox"
                  className="accent-ink-500"
                  checked={option.required}
                  onChange={(e) => updateOption(index, { required: e.target.checked })}
                />
                回答を必須にする
              </label>
            </div>
          </div>
        ))}
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
