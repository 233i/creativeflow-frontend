"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAdminPreference } from "./admin-preferences";

const media = "(max-width: 800px)";
function subscribe(listener: () => void) {
  const query = window.matchMedia(media);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** 桌面可调整宽度的非模态检查面板；窄屏使用焦点受控的全屏对话框。 */
export function DetailDrawer({
  title,
  onClose,
  children,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(media).matches,
    () => false,
  );
  const [preference, setWidth] = useAdminPreference("drawerWidth", "520");
  const width = Math.max(440, Math.min(640, Number(preference) || 520));
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!mobile) closeButton.current?.focus();
    return () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [mobile]);
  const content = (
    <>
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button
          ref={closeButton}
          size="icon-sm"
          variant="ghost"
          aria-label={`关闭${title}`}
          onPress={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      {actions && (
        <footer className="flex shrink-0 justify-end gap-2 border-t p-3">{actions}</footer>
      )}
    </>
  );
  if (mobile)
    return (
      <Dialog
        aria-label={title}
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        showCloseButton={false}
        className="!top-0 !left-0 !h-dvh !max-h-dvh !w-full !max-w-full !translate-x-0 !translate-y-0 !rounded-none !p-0 [&>[data-slot=dialog]]:!flex [&>[data-slot=dialog]]:!flex-col [&>[data-slot=dialog]]:!gap-0"
      >
        {content}
      </Dialog>
    );
  return (
    <aside
      aria-label={title}
      className="sol-admin-detail-drawer"
      style={{ width }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !document.querySelector('[data-slot="dialog-overlay"]')) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="separator"
        tabIndex={0}
        aria-label="调整详情宽度"
        aria-orientation="vertical"
        aria-valuemin={440}
        aria-valuemax={640}
        aria-valuenow={width}
        className="sol-admin-drawer-resize"
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setWidth(
              String(
                event.key === "Home"
                  ? 440
                  : event.key === "End"
                    ? 640
                    : Math.min(640, Math.max(440, width + (event.key === "ArrowLeft" ? 20 : -20))),
              ),
            );
          }
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            setWidth(
              String(
                Math.min(
                  640,
                  Math.max(
                    440,
                    event.currentTarget.parentElement!.getBoundingClientRect().right -
                      event.clientX,
                  ),
                ),
              ),
            );
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      />
      {content}
    </aside>
  );
}
