import { describe, expect, it } from "vitest";
import { getSeason, getTimeOfDay, pickGreeting } from "./greetings";

// JST の日時を UTC の Date にする（JST = UTC+9）
const jst = (y: number, m: number, d: number, h: number) => new Date(Date.UTC(y, m - 1, d, h - 9));

describe("getTimeOfDay", () => {
  it.each([
    [4, "night"],
    [5, "morning"],
    [9, "morning"],
    [10, "daytime"],
    [16, "daytime"],
    [17, "evening"],
    [21, "evening"],
    [22, "night"],
    [0, "night"],
  ])("%i時は %s", (hours, expected) => {
    expect(getTimeOfDay(hours)).toBe(expected);
  });
});

describe("getSeason", () => {
  it.each([
    [3, "spring"],
    [5, "spring"],
    [6, "summer"],
    [8, "summer"],
    [9, "autumn"],
    [11, "autumn"],
    [12, "winter"],
    [2, "winter"],
  ])("%i月は %s", (month, expected) => {
    expect(getSeason(month)).toBe(expected);
  });
});

describe("pickGreeting", () => {
  it("サーバーが UTC でも JST の時間帯で選ぶ（JST 7時＝UTC 22時でも朝の候補が入る）", () => {
    const morning = jst(2026, 10, 25, 7);
    const all = new Set(Array.from({ length: 50 }, (_, i) => pickGreeting("signin", morning, () => i / 50)));
    expect(all.has("Good morning!")).toBe(true);
    expect(all.has("Winding down tonight?")).toBe(false);
  });

  it("季節の候補も入る（10月は秋）", () => {
    const all = new Set(Array.from({ length: 50 }, (_, i) => pickGreeting("signin", jst(2026, 10, 25, 12), () => i / 50)));
    expect(all.has("Perfect weather to move!")).toBe(true);
    expect(all.has("Staying cool today?")).toBe(false);
  });

  it("新規登録は新規登録向けの候補から選ぶ", () => {
    const all = new Set(Array.from({ length: 50 }, (_, i) => pickGreeting("signup", jst(2026, 1, 10, 20), () => i / 50)));
    expect(all.has("Nice to meet you!")).toBe(true);
    expect(all.has("Welcome back!")).toBe(false);
  });

  it("乱数が 1 に近くても範囲外にならない", () => {
    expect(pickGreeting("signin", jst(2026, 10, 25, 12), () => 0.9999999)).toBeTruthy();
  });
});
