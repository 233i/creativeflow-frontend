"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

function subscribe() {
  return () => {};
}

// 兼容水合的“是否已在客户端渲染”检查，避免为主题相关界面使用
// 在副作用中设置状态并引发级联渲染的模式。
function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" isDisabled />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <TooltipTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onPress={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <Tooltip>{isDark ? "Switch to light theme" : "Switch to dark theme"}</Tooltip>
    </TooltipTrigger>
  );
}
