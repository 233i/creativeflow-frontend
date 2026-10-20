"use client";

import * as React from "react";
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Heading,
  ModalOverlay as ModalOverlayPrimitive,
  Modal as ModalPrimitive,
  type DialogProps as DialogPrimitiveProps,
  type DialogTriggerProps as DialogTriggerPrimitiveProps,
  type ModalOverlayProps as ModalOverlayPrimitiveProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function DialogTrigger({ ...props }: DialogTriggerPrimitiveProps) {
  return <DialogTriggerPrimitive data-slot="dialog-trigger" {...props} />;
}

function DialogClose({
  className,
  variant = "outline",
  size = "default",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      slot="close"
      data-slot="dialog-close"
      variant={variant}
      size={size}
      className={cn(className)}
      {...props}
    />
  );
}

function DialogOverlay({
  className,
  children,
  ...props
}: Omit<ModalOverlayPrimitiveProps, "className" | "children"> & {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ModalOverlayPrimitive
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-foreground/20 duration-150 data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0",
        className,
      )}
      {...props}
    >
      {children}
    </ModalOverlayPrimitive>
  );
}

function Dialog({
  className,
  children,
  showCloseButton = true,
  isDismissable = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: Omit<ModalOverlayPrimitiveProps, "className" | "children"> &
  Pick<React.ComponentProps<typeof ModalPrimitive>, "isDismissable"> & {
    className?: string;
    children: React.ReactNode;
    showCloseButton?: boolean;
    "aria-label"?: string;
    "aria-labelledby"?: string;
  }) {
  return (
    <DialogOverlay isDismissable={isDismissable} {...props}>
      <ModalPrimitive
        data-slot="dialog-content"
        className={cn(
          // 使用 grid-rows-[minmax(0,1fr)] 而非隐式默认值 auto：自动行会按内容自然高度定尺寸，
          // 忽略容器自身高度，因此即使对话框设置了显式高度（如设置对话框），内容仍会超出。
          // overflow-hidden 只会在视觉上裁剪，却不会真正限制内容，内部元素也就无法计算可滚动高度。
          // minmax(0,1fr) 会让行填满容器实际高度；自动尺寸对话框虽不需要，也不会受影响。
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] grid-rows-[minmax(0,1fr)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl bg-popover p-5 text-sm text-popover-foreground shadow-panel ring-1 ring-border duration-150 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 sm:max-w-md",
          className,
        )}
      >
        <DialogPrimitive
          data-slot="dialog"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="min-h-0 min-w-0 [display:inherit] [grid-template-rows:inherit] [gap:inherit] outline-none"
        >
          {children}
          {showCloseButton && (
            <DialogClose
              variant="ghost"
              className="absolute top-3 right-3 z-10 bg-popover text-muted-foreground"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>
          )}
        </DialogPrimitive>
      </ModalPrimitive>
    </DialogOverlay>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 pr-7", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-5 -mb-5 flex flex-col-reverse gap-3 rounded-b-2xl border-t bg-background p-5 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && <DialogClose variant="outline">Close</DialogClose>}
    </div>
  );
}

function DialogTitle({ className, ...props }: Omit<React.ComponentProps<typeof Heading>, "slot">) {
  return (
    <Heading
      slot="title"
      data-slot="dialog-title"
      className={cn("font-heading text-lg leading-snug font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: Omit<React.ComponentProps<"div">, "slot">) {
  return (
    <div
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  type DialogPrimitiveProps,
  type DialogTriggerPrimitiveProps,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
