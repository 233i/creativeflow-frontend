"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Activity, SlidersHorizontal, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWorkspaceElementId } from "@/components/providers/workspace-context";

export type V2InspectorMode = "node" | "run" | "input" | "debug";
const query = "(max-width: 639px)";
function mobileSnapshot() {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}
function subscribeMobile(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

/** 桌面非模态抽屉可同时操作画布；窄屏复用带焦点约束和 Escape 关闭的对话框。 */
export function V2Inspector({
  mode,
  hasRun,
  hasNode,
  onMode,
  onClose,
  children,
}: {
  mode: V2InspectorMode;
  hasRun: boolean;
  hasNode: boolean;
  onMode: (mode: V2InspectorMode) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const mobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const detailsId = useWorkspaceElementId("v2-run-details-trigger");
  const triggerId = useWorkspaceElementId("v2-run-trigger");
  const inspectorId = useWorkspaceElementId("v2-inspector");
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    return () => {
      requestAnimationFrame(() => {
        const trigger =
          previous?.isConnected && !previous.closest('[data-slot="dialog-overlay"]')
            ? previous
            : (document.getElementById(detailsId) ?? document.getElementById(triggerId));
        trigger?.focus();
      });
    };
  }, [detailsId, triggerId]);
  const label =
    mode === "input"
      ? "运行输入"
      : mode === "debug"
        ? "单节点调试"
        : mode === "run"
          ? "执行详情"
          : "节点配置";
  const content = (
    <div id={inspectorId} className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        {mode === "input" || mode === "debug" ? (
          <h2 className="text-sm font-semibold">{label}</h2>
        ) : (
          <div aria-label="右侧面板" className="flex rounded-lg bg-muted/70 p-1">
            {(["node", "run"] as const).map((tab) => {
              const Icon = tab === "node" ? SlidersHorizontal : Activity;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={tab === mode}
                  disabled={tab === "run" ? !hasRun : !hasNode}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors disabled:opacity-40",
                    tab === mode
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => onMode(tab)}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {tab === "node" ? "节点配置" : "执行详情"}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          aria-label="关闭右侧面板"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
  return mobile ? (
    <Dialog
      aria-label={label}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showCloseButton={false}
      className="top-0 right-0 left-auto h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 gap-0 rounded-none p-0 data-entering:slide-in-from-right data-exiting:slide-out-to-right data-entering:zoom-in-100 data-exiting:zoom-out-100"
    >
      {content}
    </Dialog>
  ) : (
    <aside
      aria-label={label}
      className="z-20 w-[22rem] shrink-0 border-l bg-card shadow-[-8px_0_24px_-18px_rgba(0,0,0,0.18)] xl:w-[25rem]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !document.querySelector('[data-slot="dialog-overlay"]')) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {content}
    </aside>
  );
}
