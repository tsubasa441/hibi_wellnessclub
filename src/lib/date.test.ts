import { describe, expect, it } from "vitest";
import {
  getJstParts,
  getTodayJst,
  getYearMonthJst,
  getJstMonthBounds,
  toJstDateTimeLocal,
  fromJstDateTimeLocal,
} from "@/lib/date";

describe("getJstParts", () => {
  it("UTC時刻をJST（UTC+9）の年月日時分に変換する", () => {
    // 2026-08-26T15:30:00Z = JST 2026-08-27 00:30
    const parts = getJstParts(new Date("2026-08-26T15:30:00Z"));
    expect(parts).toEqual({ year: 2026, month: 8, day: 27, hours: 0, minutes: 30, dayOfWeek: 4 });
  });

  it("日付が変わらないケースでも正しく変換する", () => {
    // 2026-08-26T00:00:00Z = JST 2026-08-26 09:00
    const parts = getJstParts(new Date("2026-08-26T00:00:00Z"));
    expect(parts).toEqual({ year: 2026, month: 8, day: 26, hours: 9, minutes: 0, dayOfWeek: 3 });
  });

  it("月・年をまたぐケースでも正しく変換する", () => {
    // 2025-12-31T15:30:00Z = JST 2026-01-01 00:30
    const parts = getJstParts(new Date("2025-12-31T15:30:00Z"));
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(1);
  });
});

describe("getTodayJst", () => {
  it("UTC基準ではまだ前日でも、JSTでは日付が変わっていれば新しい日付を返す", () => {
    // UTC 2026-08-26 20:00 = JST 2026-08-27 05:00
    expect(getTodayJst(new Date("2026-08-26T20:00:00Z"))).toBe("2026-08-27");
  });

  it("JST 0:00〜9:00の間はUTC基準の日付とJST基準の日付が異なる", () => {
    // UTC 2026-08-26 23:00 = JST 2026-08-27 08:00
    // toISOString().split("T")[0] だと "2026-08-26" になってしまうバグを防ぐ
    expect(getTodayJst(new Date("2026-08-26T23:00:00Z"))).toBe("2026-08-27");
  });
});

describe("getYearMonthJst", () => {
  it("JST基準の年月を返す", () => {
    // UTC 2026-08-31T15:00:00Z = JST 2026-09-01 00:00（月をまたぐ）
    expect(getYearMonthJst(new Date("2026-08-31T15:00:00Z"))).toBe("2026-09");
  });
});

describe("getJstMonthBounds", () => {
  it("JSTの月初0:00・月末23:59:59.999をUTC ISO文字列で返す", () => {
    const { start, end } = getJstMonthBounds("2026-08");
    // JST 2026-08-01 00:00 = UTC 2026-07-31 15:00
    expect(start).toBe("2026-07-31T15:00:00.000Z");
    // JST 2026-08-31 23:59:59.999 = UTC 2026-08-31 14:59:59.999
    expect(end).toBe("2026-08-31T14:59:59.999Z");
  });

  it("うるう年2月の月末を正しく計算する", () => {
    const { end } = getJstMonthBounds("2024-02");
    expect(end).toBe("2024-02-29T14:59:59.999Z");
  });

  it("12月から翌年1月への繰り上がりを正しく処理する", () => {
    const { start, end } = getJstMonthBounds("2025-12");
    expect(start).toBe("2025-11-30T15:00:00.000Z");
    expect(end).toBe("2025-12-31T14:59:59.999Z");
  });

  it("月初・月末の境界がその月のイベントを正しく含む", () => {
    const { start, end } = getJstMonthBounds("2026-08");
    // JST 2026-08-01 00:00:00 ちょうど（月初イベント）は範囲に含まれる
    const monthStartEventUtc = new Date("2026-07-31T15:00:00.000Z");
    // JST 2026-08-31 23:59:59（月末イベント）は範囲に含まれる
    const monthEndEventUtc = new Date("2026-08-31T14:59:59.000Z");
    // JST 2026-07-31 23:59:59（前月末、範囲外）は含まれない
    const prevMonthEventUtc = new Date("2026-07-31T14:59:59.000Z");

    expect(monthStartEventUtc >= new Date(start) && monthStartEventUtc <= new Date(end)).toBe(true);
    expect(monthEndEventUtc >= new Date(start) && monthEndEventUtc <= new Date(end)).toBe(true);
    expect(prevMonthEventUtc >= new Date(start) && prevMonthEventUtc <= new Date(end)).toBe(false);
  });
});

describe("toJstDateTimeLocal / fromJstDateTimeLocal", () => {
  it("UTCのISO文字列をJSTのdatetime-local文字列に変換する", () => {
    // UTC 2026-08-26T15:00:00Z = JST 2026-08-27 00:00
    expect(toJstDateTimeLocal("2026-08-26T15:00:00Z")).toBe("2026-08-27T00:00");
  });

  it("datetime-local文字列をJSTとして解釈しUTCのISO文字列に変換する", () => {
    // JST 2026-08-27 00:00 = UTC 2026-08-26T15:00:00Z
    expect(fromJstDateTimeLocal("2026-08-27T00:00")).toBe("2026-08-26T15:00:00.000Z");
  });

  it("往復変換で元の値に戻る", () => {
    const original = "2026-11-15T10:30:00.000Z";
    const local = toJstDateTimeLocal(original);
    expect(fromJstDateTimeLocal(local)).toBe(original);
  });
});
