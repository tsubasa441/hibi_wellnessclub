"use client";

import { useState } from "react";

export type EventOption = {
  id: string;
  label: string;
  choices: string[];
  multi_select: boolean;
  required: boolean;
};

function CheckboxDropdown({
  option,
  selected,
  onChange,
}: {
  option: EventOption;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(choice: string) {
    onChange(
      selected.includes(choice)
        ? selected.filter((v) => v !== choice)
        : [...selected, choice]
    );
  }

  const summary = selected.length > 0 ? selected.join("、") : "選択してください";

  return (
    <div className="bg-white border border-base-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 font-maru text-sm text-left"
      >
        <span className={selected.length > 0 ? "text-ink-700" : "text-ink-300"}>{summary}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`shrink-0 text-ink-300 transition ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-base-200 py-1 max-h-56 overflow-y-auto">
          {option.choices.map((choice) => (
            <label
              key={choice}
              className="flex items-center gap-2 px-3 py-2 font-maru text-sm text-ink-700 hover:bg-base-100 cursor-pointer"
            >
              <input
                type="checkbox"
                className="accent-ink-500"
                checked={selected.includes(choice)}
                onChange={() => toggle(choice)}
              />
              {choice}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventOptionFields({
  options,
  value,
  onChange,
}: {
  options: EventOption[];
  value: Record<string, string[]>;
  onChange: (next: Record<string, string[]>) => void;
}) {
  if (options.length === 0) return null;

  function setOption(id: string, values: string[]) {
    onChange({ ...value, [id]: values });
  }

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const selected = value[option.id] ?? [];
        return (
          <div key={option.id}>
            <p className="font-maru text-xs text-ink-400 mb-1">
              {option.label}
              {option.required && <span className="text-red-500">（必須）</span>}
            </p>
            {option.multi_select ? (
              <CheckboxDropdown
                option={option}
                selected={selected}
                onChange={(values) => setOption(option.id, values)}
              />
            ) : (
              <select
                value={selected[0] ?? ""}
                onChange={(e) => setOption(option.id, e.target.value ? [e.target.value] : [])}
                className="w-full bg-white border border-base-200 rounded-lg px-3 py-2.5 font-maru text-sm text-ink-700"
              >
                <option value="">選択してください</option>
                {option.choices.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
