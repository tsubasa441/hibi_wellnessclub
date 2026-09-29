"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSquareCard } from "@/lib/useSquareCard";

type Event = { id: string; title: string; price: number };
type PaymentMethod = "square" | "paypay";
type SavedCard = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null } | null;

type OptionSelectionPayload = { optionId: string; values: string[] };

export default function CheckoutForm({
  event,
  userId,
  locationId,
  pointsBalance,
  savedCard = null,
  optionSelections = [],
}: {
  event: Event;
  userId: string;
  locationId: string;
  pointsBalance: number;
  savedCard?: SavedCard;
  optionSelections?: OptionSelectionPayload[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("square");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState("0");
  const [useNewCard, setUseNewCard] = useState(!savedCard);

  const maxPoints = Math.max(0, Math.min(pointsBalance, event.price));
  const pointsToUse = Math.max(0, Math.min(Math.floor(Number(pointsInput) || 0), maxPoints));
  const discountedAmount = event.price - pointsToUse;
  const willUseSavedCard = method === "square" && discountedAmount > 0 && !!savedCard && !useNewCard;
  const needsCardInput = method === "square" && discountedAmount > 0 && !willUseSavedCard;

  const { error: cardError, tokenize } = useSquareCard("card-container", needsCardInput, locationId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // PayPayアプリでの支払い完了後にHibiへ戻れないケースがあるため、同一ウィンドウで遷移せず
    // 新しいウィンドウで開く（PayPay公式FAQ推奨）。ポップアップブロックを避けるため、
    // クリックと同期的に空ウィンドウを先に開いておき、URLが取得でき次第そこへ遷移させる
    const paypayWindow = method === "paypay" ? window.open("", "_blank") : null;

    try {
      let sourceId = "FREE";

      if (needsCardInput) {
        sourceId = await tokenize();
      }

      const res = await fetch(`/api/payments/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          userId,
          sourceId,
          useSavedCard: willUseSavedCard,
          pointsToUse,
          optionSelections,
          userAgent: navigator.userAgent,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "決済に失敗しました");

      // ポイント全額充当等で即時確定した場合は success:true かつ相対パスの redirectUrl が返る
      // （実際のPayPay決済URLではないため、新しいウィンドウではなく現在の画面で遷移する）
      if (method === "paypay" && data.redirectUrl && !data.success) {
        if (paypayWindow) {
          paypayWindow.location.href = data.redirectUrl;
        } else {
          // ポップアップがブロックされた場合は従来どおり同一ウィンドウで遷移する
          window.location.href = data.redirectUrl;
        }
        return;
      }

      paypayWindow?.close();
      router.push(`/events/${event.id}?booked=1`);
      router.refresh();
    } catch (err: unknown) {
      paypayWindow?.close();
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
              <div className="w-20 h-14 shrink-0 bg-white rounded-lg border border-base-200 flex items-center justify-center overflow-hidden">
                <Image src="/images/square-logo.png" alt="Square" width={72} height={18} />
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
              <div className="w-20 h-14 shrink-0 bg-white rounded-lg border border-base-200 flex items-center justify-center overflow-hidden">
                <Image src="/images/paypay-logo.png" alt="PayPay" width={52} height={52} />
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

      {method === "square" && discountedAmount > 0 && willUseSavedCard && (
        <div className="bg-white rounded-xl border border-base-200 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-outfit text-xs text-ink-300 mb-1">登録済みのカードで支払う</p>
            <p className="font-outfit text-sm font-medium text-ink-700">
              {savedCard?.brand ?? "カード"} •••• {savedCard?.last4}
              <span className="font-dm text-xs text-ink-300 ml-2">
                有効期限 {String(savedCard?.expMonth).padStart(2, "0")}/{String(savedCard?.expYear).slice(-2)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUseNewCard(true)}
            className="font-outfit text-xs text-sage-600 hover:text-sage-500 transition shrink-0"
          >
            別のカードを使う
          </button>
        </div>
      )}

      {needsCardInput && (
        <div className="bg-white rounded-xl border border-base-200 p-4">
          <p className="font-outfit text-xs text-ink-300 mb-1">カード情報</p>
          {process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT !== "production" && (
            <p className="font-dm text-xs text-ink-300 mb-3">
              テスト環境です。ZIPは「00000」と入力してください
            </p>
          )}
          <div id="card-container" />
          <p className="font-dm text-xs text-ink-300 mt-3">
            次回以降の支払いのため、このカードは自動的に保存されます。
          </p>
          {savedCard && (
            <button
              type="button"
              onClick={() => setUseNewCard(false)}
              className="font-outfit text-xs text-sage-600 hover:text-sage-500 transition mt-2"
            >
              登録済みのカードを使う
            </button>
          )}
        </div>
      )}

      {(error || cardError) && (
        <div className="bg-red-50 text-red-600 font-dm text-sm rounded-lg px-4 py-3">{error ?? cardError}</div>
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
