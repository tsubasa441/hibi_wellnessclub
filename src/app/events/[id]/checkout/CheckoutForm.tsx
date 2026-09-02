"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Event = { id: string; title: string; price: number };
type PaymentMethod = "square" | "paypay";

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string, options?: SquareInitOptions) => Promise<SquarePayments>;
    };
  }
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

interface SquareInitOptions {
  countryCode: string;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => Promise<void>;
}

type OptionSelectionPayload = { optionId: string; values: string[] };

export default function CheckoutForm({
  event,
  userId,
  locationId,
  pointsBalance,
  optionSelections = [],
}: {
  event: Event;
  userId: string;
  locationId: string;
  pointsBalance: number;
  optionSelections?: OptionSelectionPayload[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("square");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState("0");
  const cardRef = useRef<SquareCard | null>(null);

  const maxPoints = Math.max(0, Math.min(pointsBalance, event.price));
  const pointsToUse = Math.max(0, Math.min(Math.floor(Number(pointsInput) || 0), maxPoints));
  const discountedAmount = event.price - pointsToUse;
  const needsCard = method === "square" && discountedAmount > 0;

  useEffect(() => {
    if (!needsCard) return;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!;
    let active = true;
    let localCard: SquareCard | null = null;

    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (window.Square) { resolve(); return; }
        const existing = document.querySelector('script[src*="squarecdn.com"]');
        if (existing) { existing.addEventListener("load", () => resolve()); return; }
        const script = document.createElement("script");
        const isProduction = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT === "production";
        script.src = isProduction
          ? "https://web.squarecdn.com/v1/square.js"
          : "https://sandbox.web.squarecdn.com/v1/square.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Square SDK の読み込みに失敗しました"));
        document.head.appendChild(script);
      });

    async function initCard() {
      try {
        await loadScript();
        if (!active) return;
        const payments = await window.Square!.payments(appId, locationId, { countryCode: "JP" });
        if (!active) return;
        localCard = await payments.card();
        if (!active) { localCard.destroy(); return; }
        await localCard.attach("#card-container");
        cardRef.current = localCard;
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "カードフォームの初期化に失敗しました");
      }
    }

    initCard();

    return () => {
      active = false;
      if (localCard) localCard.destroy();
      cardRef.current = null;
    };
  }, [needsCard, locationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let sourceId = "FREE";

      if (needsCard) {
        if (!cardRef.current) throw new Error("カードフォームが準備できていません");
        const result = await cardRef.current.tokenize();
        if (result.status !== "OK" || !result.token) {
          throw new Error(result.errors?.[0]?.message ?? "カード情報の取得に失敗しました");
        }
        sourceId = result.token;
      }

      const res = await fetch(`/api/payments/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, userId, sourceId, pointsToUse, optionSelections }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "決済に失敗しました");

      if (method === "paypay" && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      router.push(`/events/${event.id}?booked=1`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "決済に失敗しました");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="font-outfit text-sm font-medium text-ink-700 mb-3">お支払い方法を選択</p>
        <div className="space-y-3">
          <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${method === "square" ? "border-ink-500 bg-sage-100" : "border-base-200 bg-white"}`}>
            <input type="radio" name="method" value="square" checked={method === "square"} onChange={() => setMethod("square")} className="accent-ink-500" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ink-800 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <p className="font-outfit font-medium text-sm text-ink-700">クレジットカード</p>
                <p className="font-dm text-xs text-ink-300">Square で安全に決済</p>
              </div>
            </div>
          </label>

          <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${method === "paypay" ? "border-ink-500 bg-sage-100" : "border-base-200 bg-white"}`}>
            <input type="radio" name="method" value="paypay" checked={method === "paypay"} onChange={() => setMethod("paypay")} className="accent-ink-500" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">Pay</span>
              </div>
              <div>
                <p className="font-outfit font-medium text-sm text-ink-700">PayPay</p>
                <p className="font-dm text-xs text-ink-300">PayPay アプリで決済</p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {event.price > 0 && pointsBalance > 0 && (
        <div className="bg-white rounded-xl border border-base-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-outfit text-xs font-medium text-ink-700">ポイントを使う</p>
            <p className="font-dm text-xs text-ink-300">保有 {pointsBalance.toLocaleString()}pt</p>
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={maxPoints}
            step={1}
            value={pointsInput}
            onChange={(e) => setPointsInput(e.target.value)}
            onBlur={() => setPointsInput(String(pointsToUse))}
            className="w-full rounded-lg border border-base-200 px-3 py-2 font-outfit text-sm text-ink-700"
          />
          <p className="font-dm text-xs text-ink-300 mt-1">最大 {maxPoints.toLocaleString()}pt まで利用できます（1pt = 1円）</p>
        </div>
      )}

      {event.price > 0 && (
        <div className="bg-base-100 rounded-xl p-4 space-y-1">
          <div className="flex justify-between font-dm text-sm text-ink-500">
            <span>参加費</span>
            <span>¥{event.price.toLocaleString()}</span>
          </div>
          {pointsToUse > 0 && (
            <div className="flex justify-between font-dm text-sm text-ink-500">
              <span>ポイント割引</span>
              <span>-¥{pointsToUse.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-outfit font-semibold text-ink-700 pt-1 border-t border-base-200">
            <span>お支払い金額</span>
            <span>¥{discountedAmount.toLocaleString()}</span>
          </div>
        </div>
      )}

      {needsCard && (
        <div className="bg-white rounded-xl border border-base-200 p-4">
          <p className="font-outfit text-xs text-ink-300 mb-1">カード情報</p>
          {process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT !== "production" && (
            <p className="font-dm text-xs text-ink-300 mb-3">
              テスト環境です。ZIPは「00000」と入力してください
            </p>
          )}
          <div id="card-container" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 font-dm text-sm rounded-lg px-4 py-3">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-sage-500 text-white font-outfit font-medium py-4 rounded-full hover:bg-sage-600 transition disabled:opacity-60 text-lg"
      >
        {loading ? "処理中..." : discountedAmount === 0 ? "予約する" : `¥${discountedAmount.toLocaleString()} を支払う`}
      </button>

      <p className="font-dm text-xs text-ink-300 text-center">
        支払いボタンを押すと、キャンセルポリシーに同意したものとみなします。
      </p>
    </form>
  );
}
