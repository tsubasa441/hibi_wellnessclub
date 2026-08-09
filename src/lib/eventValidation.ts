export const EVENT_TYPES = new Set(["yoga", "training", "running", "boxing"]);
export const EVENT_STATUSES = new Set(["draft", "published", "cancelled"]);

export type EventInput = {
  title?: string;
  description?: string;
  eventType?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  capacity?: number;
  price?: number;
  status?: string;
};

export function validateEventInput(body: EventInput): string | null {
  if (!body.title || !body.title.trim() || body.title.trim().length > 100) {
    return "タイトルを1〜100文字で入力してください";
  }
  if (body.description && body.description.length > 2000) {
    return "説明文は2000文字以内で入力してください";
  }
  if (!body.eventType || !EVENT_TYPES.has(body.eventType)) {
    return "イベント種別が正しくありません";
  }
  if (!body.startAt || Number.isNaN(new Date(body.startAt).getTime())) {
    return "開始日時が正しくありません";
  }
  if (!body.endAt || Number.isNaN(new Date(body.endAt).getTime())) {
    return "終了日時が正しくありません";
  }
  if (new Date(body.endAt) <= new Date(body.startAt)) {
    return "終了日時は開始日時より後にしてください";
  }
  if (!body.location || !body.location.trim() || body.location.trim().length > 200) {
    return "開催場所を1〜200文字で入力してください";
  }
  if (!Number.isInteger(body.capacity) || (body.capacity as number) < 1) {
    return "定員は1以上の整数で入力してください";
  }
  if (!Number.isInteger(body.price) || (body.price as number) < 0) {
    return "価格は0以上の整数で入力してください";
  }
  if (!body.status || !EVENT_STATUSES.has(body.status)) {
    return "ステータスが正しくありません";
  }
  return null;
}
