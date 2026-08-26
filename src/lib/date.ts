// Hibi は日本国内向けのため、日付・時刻は常に日本時間（JST, UTC+9・夏時間なし）を基準に扱う。
// サーバーの実行タイムゾーンは環境によって異なる（ローカル開発機は多くの場合JSTだが、
// Vercelのサーバーレス関数はUTCで動作する）。getHours() 等のローカルタイムゾーン依存メソッドや
// timeZone未指定のtoLocaleString()は環境によって結果が変わってしまうため使わず、
// 日付・時刻を扱う箇所は必ずこのファイル経由でJST基準の値を取得する。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 指定した日時をJSTとして解釈した場合の年月日・時刻要素を返す
export function getJstParts(date: Date) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1, // 1-12
    day: jst.getUTCDate(),
    hours: jst.getUTCHours(),
    minutes: jst.getUTCMinutes(),
    dayOfWeek: jst.getUTCDay(), // 0(日)〜6(土)
  };
}

// JST基準の「YYYY-MM-DD」（ジャーナルの1日1回判定・生年月日チェック等に使用）
export function getTodayJst(now: Date = new Date()): string {
  const { year, month, day } = getJstParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// JST基準の「YYYY-MM」
export function getYearMonthJst(date: Date = new Date()): string {
  const { year, month } = getJstParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

// 指定した「YYYY-MM」のJST基準の月初0:00・月末23:59:59.999をUTC ISO文字列で返す
// （Supabaseのtimestamptz列はUTC保存のため、範囲検索にはUTC境界に変換した値が必要）
export function getJstMonthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split("-").map(Number);
  const startMs = Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - JST_OFFSET_MS;
  const endMs = Date.UTC(y, m, 1, 0, 0, 0, 0) - JST_OFFSET_MS - 1;
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

// 管理画面の datetime-local 入力欄用: UTCで保存されたISO日時を、
// JSTの壁時計時刻として "YYYY-MM-DDTHH:mm" 形式に変換する（<input type="datetime-local">にそのまま渡せる）
export function toJstDateTimeLocal(iso: string): string {
  const { year, month, day, hours, minutes } = getJstParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

// toJstDateTimeLocal の逆変換: datetime-local の "YYYY-MM-DDTHH:mm" 文字列を
// JSTの壁時計時刻として解釈し、UTCのISO文字列に変換する
export function fromJstDateTimeLocal(value: string): string {
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, mi, 0, 0) - JST_OFFSET_MS;
  return new Date(utcMs).toISOString();
}
