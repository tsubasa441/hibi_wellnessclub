import { SquareClient, SquareEnvironment } from "square";

let client: SquareClient | null = null;

// 決済API（square/route.ts）とカード保存ヘルパー（squareCards.ts）で同じ設定の
// クライアントを使い回す（モジュール初回読み込み時に一度だけ生成）
export function getSquareClient(): SquareClient {
  if (!client) {
    client = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN!,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }
  return client;
}
