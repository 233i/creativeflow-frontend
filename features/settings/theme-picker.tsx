"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useT } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "general.themeLight", icon: Sun },
  { value: "dark", label: "general.themeDark", icon: Moon },
  { value: "system", label: "general.themeSystem", icon: Monitor },
] as const;

/** 原生单选保留方向键和焦点行为；只负责外观偏好，不涉及模型设置。 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const t = useT();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 text-sm font-medium">{t("general.theme")}</legend>
      <div className="grid grid-cols-3 gap-3">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "relative flex cursor-pointer flex-col items-center gap-3 rounded-xl border px-2 py-5 text-sm transition-colors hover:bg-accent/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              (theme ?? "system") === value
                ? "border-primary/50 bg-accent text-primary"
                : "text-muted-foreground",
            )}
          >
            <input
              className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
              type="radio"
              name="studio-theme"
              value={value}
              checked={(theme ?? "system") === value}
              onChange={() => setTheme(value)}
            />
            <Icon className="pointer-events-none size-5" aria-hidden />
            <span className="pointer-events-none text-center">{t(label)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
