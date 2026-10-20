import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 共享工作区顶栏。业务页面决定操作，外壳仅保证布局、层级及窄屏换行。 */
export function StudioHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "studio-header absolute inset-x-0 top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 sm:flex-nowrap",
        className,
      )}
    >
      {children}
    </header>
  );
}
