"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type MoodKey = "great" | "good" | "neutral" | "low" | "bad";
type EnergyKey = "high" | "good" | "neutral" | "tired" | "unwell";

const MOODS: { key: MoodKey; emoji: string; label: string }[] = [
  { key: "great",   emoji: "😄", label: "最高" },
  { key: "good",    emoji: "🙂", label: "いい" },
  { key: "neutral", emoji: "😐", label: "普通" },
  { key: "low",     emoji: "😔", label: "低め" },
  { key: "bad",     emoji: "😞", label: "辛い" },
];

const ENERGIES: { key: EnergyKey; emoji: string; label: string }[] = [
  { key: "high",    emoji: "💪", label: "元気" },
  { key: "good",    emoji: "🙂", label: "良い" },
  { key: "neutral", emoji: "😐", label: "普通" },
  { key: "tired",   emoji: "😴", label: "疲れ" },
  { key: "unwell",  emoji: "🤒", label: "不調" },
];

export default function JournalQuickEntry({ alreadyRecorded }: { alreadyRecorded: boolean }) {
  const router = useRouter();
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [energy, setEnergy] = useState<EnergyKey | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyRecorded);

  async function handleSubmit() {
    if (!mood || !energy) return;
    setLoading(true);
    const res = await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood, energy, note }),
    });
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="nm-card p-5 text-center">
        <p className="font-outfit text-sm font-semibold text-ink-700 mb-1">今日のジャーナル</p>
        <p className="font-dm text-xs text-ink-300">今日の記録は完了しています</p>
      </div>
    );
  }

  return (
    <div className="nm-card-sm p-5 space-y-5">
      <p className="font-outfit text-sm font-semibold text-ink-700">今日のジャーナルを記録する</p>

      {/* 今日の気分 */}
      <div>
        <p className="font-dm text-xs text-ink-300 mb-2">今日の気分</p>
        <div className="flex gap-2 justify-between">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(m.key)}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition ${
                mood === m.key
                  ? "shadow-[inset_1px_1px_3px_#BCC0BE,inset_-1px_-1px_3px_#FBFBFB] text-ink-700"
                  : "shadow-[1px_1px_3px_#BCC0BE,-1px_-1px_3px_#FBFBFB]"
              }`}
              style={{ background: "var(--nm-bg)" }}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className="font-dm text-[10px] text-ink-300">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 今日の体調 */}
      <div>
        <p className="font-dm text-xs text-ink-300 mb-2">今日の体調</p>
        <div className="flex gap-2 justify-between">
          {ENERGIES.map((e) => (
            <button
              key={e.key}
              onClick={() => setEnergy(e.key)}
              className={`flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition ${
                energy === e.key
                  ? "shadow-[inset_1px_1px_3px_#BCC0BE,inset_-1px_-1px_3px_#FBFBFB] text-ink-700"
                  : "shadow-[1px_1px_3px_#BCC0BE,-1px_-1px_3px_#FBFBFB]"
              }`}
              style={{ background: "var(--nm-bg)" }}
            >
              <span className="text-xl">{e.emoji}</span>
              <span className="font-dm text-[10px] text-ink-300">{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 気づき */}
      <div>
        <p className="font-dm text-xs text-ink-300 mb-2">気づき（任意）</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="今日気づいたこと、感じたことを自由に..."
          rows={3}
          className="w-full rounded-xl px-4 py-3 font-dm text-sm text-ink-700 placeholder-ink-200 resize-none focus:outline-none transition"
          style={{ background: "var(--nm-bg)", boxShadow: "inset 1px 1px 3px #BCC0BE, inset -1px -1px 3px #FBFBFB" }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!mood || !energy || loading}
        className="w-full nm-btn-primary text-white font-outfit font-medium text-sm py-3 disabled:opacity-40"
      >
        {loading ? "保存中..." : "記録する"}
      </button>
    </div>
  );
}
