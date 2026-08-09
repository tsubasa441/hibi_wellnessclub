import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("空配列の場合はBOMのみを返す", () => {
    expect(toCsv([])).toBe(BOM);
  });

  it("ヘッダー行とデータ行をCSV形式で生成する", () => {
    const csv = toCsv([
      { 氏名: "山田太郎", ポイント: 100 },
      { 氏名: "佐藤花子", ポイント: 200 },
    ]);

    expect(csv).toBe(
      `${BOM}氏名,ポイント\r\n山田太郎,100\r\n佐藤花子,200`
    );
  });

  it("カンマを含む値をダブルクォートで囲む", () => {
    const csv = toCsv([{ 備考: "東京,渋谷" }]);
    expect(csv).toBe(`${BOM}備考\r\n"東京,渋谷"`);
  });

  it("改行を含む値をダブルクォートで囲む", () => {
    const csv = toCsv([{ 備考: "1行目\n2行目" }]);
    expect(csv).toBe(`${BOM}備考\r\n"1行目\n2行目"`);
  });

  it("ダブルクォートを含む値はエスケープしてダブルクォートで囲む", () => {
    const csv = toCsv([{ 備考: '「予約」済み' }]);
    expect(csv).toBe(`${BOM}備考\r\n「予約」済み`);
  });

  it("値自体がダブルクォート文字を含む場合は二重化する", () => {
    const csv = toCsv([{ 備考: 'say "hi"' }]);
    expect(csv).toBe(`${BOM}備考\r\n"say ""hi"""`);
  });
});
