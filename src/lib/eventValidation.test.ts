import { describe, expect, it } from "vitest";
import {
  validateEventOptions,
  buildOptionSelections,
  EventOptionRow,
} from "./eventValidation";

describe("validateEventOptions", () => {
  it("未指定（undefined）は許容する", () => {
    expect(validateEventOptions(undefined)).toBeNull();
  });

  it("正常な選択項目は null を返す", () => {
    expect(
      validateEventOptions([
        { label: "Tシャツサイズ", choices: ["S", "M", "L"], multiSelect: false, required: true },
        { label: "参加動機", choices: ["健康", "交流"], multiSelect: true },
      ])
    ).toBeNull();
  });

  it("項目名が空だとエラー", () => {
    expect(validateEventOptions([{ label: "  ", choices: ["A"] }])).toContain("項目名");
  });

  it("選択肢が0個だとエラー", () => {
    expect(validateEventOptions([{ label: "サイズ", choices: [] }])).toContain("選択肢");
  });

  it("選択肢が重複しているとエラー", () => {
    expect(
      validateEventOptions([{ label: "サイズ", choices: ["M", "M"] }])
    ).toContain("重複");
  });

  it("項目数が上限を超えるとエラー", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ label: `項目${i}`, choices: ["A"] }));
    expect(validateEventOptions(many)).toContain("10");
  });

  it("配列でないとエラー", () => {
    expect(validateEventOptions({} as unknown)).toContain("形式");
  });
});

describe("buildOptionSelections", () => {
  const options: EventOptionRow[] = [
    { id: "o1", label: "Tシャツサイズ", choices: ["S", "M", "L"], multi_select: false, required: true },
    { id: "o2", label: "参加動機", choices: ["健康", "交流", "その他"], multi_select: true, required: false },
  ];

  it("正常な回答をスナップショットに変換する", () => {
    const { error, selections } = buildOptionSelections(options, [
      { optionId: "o1", values: ["M"] },
      { optionId: "o2", values: ["健康", "交流"] },
    ]);
    expect(error).toBeNull();
    expect(selections).toEqual([
      { option_id: "o1", label: "Tシャツサイズ", values: ["M"] },
      { option_id: "o2", label: "参加動機", values: ["健康", "交流"] },
    ]);
  });

  it("必須項目が未回答だとエラー", () => {
    const { error } = buildOptionSelections(options, [{ optionId: "o2", values: ["健康"] }]);
    expect(error).toContain("Tシャツサイズ");
  });

  it("単一選択項目に複数値を送るとエラー", () => {
    const { error } = buildOptionSelections(options, [{ optionId: "o1", values: ["S", "M"] }]);
    expect(error).toContain("1つだけ");
  });

  it("選択肢に存在しない値を送るとエラー", () => {
    const { error } = buildOptionSelections(options, [{ optionId: "o1", values: ["XL"] }]);
    expect(error).toContain("正しくありません");
  });

  it("任意項目が未回答ならスナップショットに含めない", () => {
    const { error, selections } = buildOptionSelections(options, [{ optionId: "o1", values: ["S"] }]);
    expect(error).toBeNull();
    expect(selections).toEqual([{ option_id: "o1", label: "Tシャツサイズ", values: ["S"] }]);
  });

  it("選択項目が無いイベントでは空配列を返す", () => {
    const { error, selections } = buildOptionSelections([], [{ optionId: "x", values: ["y"] }]);
    expect(error).toBeNull();
    expect(selections).toEqual([]);
  });

  it("重複値は除去される", () => {
    const { selections } = buildOptionSelections(options, [
      { optionId: "o1", values: ["M"] },
      { optionId: "o2", values: ["健康", "健康"] },
    ]);
    expect(selections[1].values).toEqual(["健康"]);
  });
});
