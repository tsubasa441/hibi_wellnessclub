export const EVENT_TYPES = new Set(["yoga", "training", "running", "boxing", "pilates"]);
export const EVENT_STATUSES = new Set(["draft", "published", "cancelled"]);

export const MAX_EVENT_OPTIONS = 10;
export const MAX_OPTION_CHOICES = 20;

export type EventOptionInput = {
  label?: string;
  choices?: string[];
  multiSelect?: boolean;
  required?: boolean;
};

export type EventInput = {
  title?: string;
  description?: string;
  eventType?: string;
  startAt?: string;
  endAt?: string;
  location?: string;
  meetingPlace?: string;
  remarks?: string;
  belongings?: string;
  capacity?: number;
  price?: number;
  status?: string;
  options?: EventOptionInput[];
};

export function validateEventOptions(options: unknown): string | null {
  if (options === undefined || options === null) return null;
  if (!Array.isArray(options)) {
    return "選択項目の形式が正しくありません";
  }
  if (options.length > MAX_EVENT_OPTIONS) {
    return `選択項目は${MAX_EVENT_OPTIONS}個までです`;
  }

  for (const option of options as EventOptionInput[]) {
    const label = option?.label?.trim() ?? "";
    if (!label || label.length > 50) {
      return "選択項目の項目名は1〜50文字で入力してください";
    }
    if (!Array.isArray(option?.choices)) {
      return "選択項目の選択肢の形式が正しくありません";
    }
    const choices = option.choices.map((c) => (typeof c === "string" ? c.trim() : "")).filter(Boolean);
    if (choices.length < 1 || choices.length > MAX_OPTION_CHOICES) {
      return `「${label}」の選択肢は1〜${MAX_OPTION_CHOICES}個で入力してください`;
    }
    if (choices.some((c) => c.length > 50)) {
      return `「${label}」の選択肢は各50文字以内で入力してください`;
    }
    if (new Set(choices).size !== choices.length) {
      return `「${label}」の選択肢が重複しています`;
    }
  }

  return null;
}

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
  if (body.meetingPlace && body.meetingPlace.length > 200) {
    return "集合場所は200文字以内で入力してください";
  }
  if (body.remarks && body.remarks.length > 1000) {
    return "備考は1000文字以内で入力してください";
  }
  if (body.belongings && body.belongings.length > 500) {
    return "持ち物は500文字以内で入力してください";
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
  const optionsError = validateEventOptions(body.options);
  if (optionsError) return optionsError;
  return null;
}

// 予約時にユーザーから送られてくる選択項目の回答を検証し、
// bookings.option_selections へ保存するスナップショットを組み立てる。
export type EventOptionRow = {
  id: string;
  label: string;
  choices: string[];
  multi_select: boolean;
  required: boolean;
};

export type OptionSelectionInput = {
  optionId?: string;
  values?: string[];
};

export type OptionSelectionSnapshot = {
  option_id: string;
  label: string;
  values: string[];
};

export function buildOptionSelections(
  eventOptions: EventOptionRow[],
  submitted: unknown
): { error: string | null; selections: OptionSelectionSnapshot[] } {
  const list: OptionSelectionInput[] = Array.isArray(submitted) ? submitted : [];
  const byId = new Map<string, string[]>();
  for (const item of list) {
    if (item && typeof item.optionId === "string") {
      const values = Array.isArray(item.values)
        ? item.values.filter((v): v is string => typeof v === "string")
        : [];
      byId.set(item.optionId, values);
    }
  }

  const selections: OptionSelectionSnapshot[] = [];

  for (const option of eventOptions) {
    const rawValues = byId.get(option.id) ?? [];

    if (rawValues.some((v) => !option.choices.includes(v))) {
      return { error: `「${option.label}」の選択内容が正しくありません`, selections: [] };
    }

    const values = Array.from(new Set(rawValues.filter((v) => option.choices.includes(v))));

    if (option.required && values.length === 0) {
      return { error: `「${option.label}」を選択してください`, selections: [] };
    }
    if (!option.multi_select && values.length > 1) {
      return { error: `「${option.label}」は1つだけ選択できます`, selections: [] };
    }

    if (values.length > 0) {
      selections.push({ option_id: option.id, label: option.label, values });
    }
  }

  return { error: null, selections };
}
