"use client";
import type { ComponentProps } from "react";
import { Dialog } from "tdesign-react";
import { useWorkspaceActive } from "@/components/providers/workspace-context";

/** 隐藏工作区的弹层随页面隐藏，表单仍由原页面保存。 */
export function ManagementDialog(props: ComponentProps<typeof Dialog>) {
  const active = useWorkspaceActive();
  return <Dialog {...props} visible={active && props.visible} />;
}
