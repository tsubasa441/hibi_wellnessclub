"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string, options?: { countryCode: string }) => Promise<SquarePayments>;
    };
  }
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => Promise<void>;
}

function loadSquareScript(): Promise<void> {
  return new Promise((resolve, reject) => {
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
}

// 決済画面（CheckoutForm）と設定画面（SettingsDrawer）で共通の、Square カード入力欄の
// 読み込み・アタッチ・トークン化ロジック。containerId の要素に描画する
export function useSquareCard(containerId: string, active: boolean, locationId: string) {
  const cardRef = useRef<SquareCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APP_ID!;
    let alive = true;
    let localCard: SquareCard | null = null;

    async function init() {
      try {
        await loadSquareScript();
        if (!alive) return;
        const payments = await window.Square!.payments(appId, locationId, { countryCode: "JP" });
        if (!alive) return;
        localCard = await payments.card();
        if (!alive) { localCard.destroy(); return; }
        await localCard.attach(`#${containerId}`);
        cardRef.current = localCard;
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "カードフォームの初期化に失敗しました");
      }
    }

    init();

    return () => {
      alive = false;
      if (localCard) localCard.destroy();
      cardRef.current = null;
    };
  }, [active, containerId, locationId]);

  async function tokenize(): Promise<string> {
    if (!cardRef.current) throw new Error("カードフォームが準備できていません");
    const result = await cardRef.current.tokenize();
    if (result.status !== "OK" || !result.token) {
      throw new Error(result.errors?.[0]?.message ?? "カード情報の取得に失敗しました");
    }
    return result.token;
  }

  return { error, setError, tokenize };
}
