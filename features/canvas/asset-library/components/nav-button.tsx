"use client";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
export function LibraryNavButton({
  icon: Icon,
  label,
  count,
  active,
  onPress,
  dropTarget = false,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  dropTarget?: boolean;
  isDragOver?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: React.DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        isDragOver && "bg-primary/10 text-primary ring-1 ring-primary/40",
      )}
      aria-current={active ? "page" : undefined}
      onClick={onPress}
      onDragOver={dropTarget ? onDragOver : undefined}
      onDragLeave={dropTarget ? onDragLeave : undefined}
      onDrop={dropTarget ? onDrop : undefined}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[0.625rem] tabular-nums opacity-60">{count}</span>
    </button>
  );
}
