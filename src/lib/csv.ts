// 汎用CSV生成ヘルパー。Excel（日本語ロケール）で文字化けしないよう先頭にBOMを付与する。
export function toCsv(rows: Record<string, string | number>[]): string {
  const BOM = "﻿";
  if (rows.length === 0) return BOM;

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number): string => {
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  return BOM + lines.join("\r\n");
}
