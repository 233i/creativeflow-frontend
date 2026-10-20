"use client";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import { Check, Copy } from "lucide-react";
import Link from "next/link";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterTitleCell({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  return (
    <td>
      <CenterTitleContent controller={controller} item={item} />
    </td>
  );
}

/** 可嵌入 TDesign Table 单元格的名称内容。 */
export function CenterTitleContent({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  const { href, copied, copyId } = controller;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Link
        className="sol-admin-row-title min-w-0 flex-1"
        href={href(item)}
        title={item.description || item.name}
      >
        {item.name}
      </Link>
      {item.source === "template" && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-1 text-[13px] text-muted-foreground">
          历史模板来源
        </span>
      )}
      <button
        aria-label={`复制 ${item.name} 的 ID`}
        title={item.id}
        onClick={() => void copyId(item)}
        className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground"
      >
        {copied === item.source + item.id ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
