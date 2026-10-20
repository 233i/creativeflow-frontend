"use client";
import { Switch } from "@/components/ui/switch";

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs">{label}</span>
      <Switch isSelected={value} onChange={onChange} aria-label={label} />
    </div>
  );
}
