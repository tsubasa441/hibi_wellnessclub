// チェックインを受け付ける時間帯：イベント開始の30分前〜開始の15分後（2026-10-25、依頼者の指定。
// 以前は開始〜終了の間）。チェックイン API（サーバー側の判定）とボタン（表示）で共通に使う
export const CHECKIN_OPENS_BEFORE_MINUTES = 30;
export const CHECKIN_CLOSES_AFTER_MINUTES = 15;

export function getCheckinWindow(startAt: string): { opensAt: number; closesAt: number } {
  const start = new Date(startAt).getTime();
  return {
    opensAt: start - CHECKIN_OPENS_BEFORE_MINUTES * 60 * 1000,
    closesAt: start + CHECKIN_CLOSES_AFTER_MINUTES * 60 * 1000,
  };
}
