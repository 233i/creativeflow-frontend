"use client";

import { useState } from "react";
import { DatePicker, Select } from "tdesign-react";
import { dateBoundary } from "../query-state";

type SelectProps = {
  label: string;
  placeholder?: string;
  value?: string;
  options: { value: string; label: string }[];
  filterable?: boolean;
  onChange: (value: string) => void;
};

export function FilterSelect({ label, value = "", onChange, ...props }: SelectProps) {
  return (
    <label className="min-w-0 basis-2/5 grow sm:w-40 sm:basis-auto sm:grow-0">
      <span className="sr-only">{label}</span>
      <Select {...props} value={value} onChange={(next) => onChange(String(next ?? ""))} />
    </label>
  );
}

type DateProps = {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
};

export function FilterDate({ label, value, onChange }: DateProps) {
  const selected = dateBoundary(value, false) ? (value ?? "") : "";
  const [draft, setDraft] = useState({ value: selected, text: selected });
  if (draft.value !== selected) {
    setDraft({ value: selected, text: selected });
  }
  const text = draft.value === selected ? draft.text : selected;
  function commit(next: string) {
    if (next && !dateBoundary(next, false)) {
      setDraft({ value: selected, text: selected });
      return;
    }
    setDraft({ value: selected, text: next });
    if (next !== selected) onChange(next);
  }
  return (
    <label
      className="grid min-w-0 basis-2/5 grow gap-1 text-xs text-muted-foreground sm:w-44 sm:basis-auto sm:grow-0"
      onInputCapture={(event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement && event.currentTarget.contains(input)) {
          setDraft({ value: selected, text: input.value });
        }
      }}
    >
      <span>{label}</span>
      <DatePicker
        className="w-full"
        allowInput
        clearable
        placeholder="选择日期"
        format="YYYY-MM-DD"
        valueType="YYYY-MM-DD"
        value={selected}
        // TDesign 1.18 的日期弹层展开后会清空非受控输入；显式保留键入草稿。
        inputProps={{ value: text }}
        onChange={(date, context) => commit(context.trigger === "enter" ? text : String(date))}
        onBlur={({ value: next }) => commit(String(next))}
      />
    </label>
  );
}
