"use client";
import { statusLabel } from "@/features/admin/request-history/request-detail";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterRunCell({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  return (
    <td>
      <CenterRunContent controller={controller} item={item} />
    </td>
  );
}

/** 可嵌入 TDesign Table 单元格的最近运行内容。 */
export function CenterRunContent({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  const { setSelected } = controller;
  return item.latestRun ? (
    <button
      onClick={() => setSelected(item)}
      title={`最近一次运行：${new Date(item.latestRun.createdAt).toLocaleString()}`}
      className="sol-admin-status !flex-col !gap-0 !leading-4"
      data-tone={
        item.latestRun.status === "failed"
          ? "error"
          : item.latestRun.status === "succeeded"
            ? "success"
            : "active"
      }
    >
      <span>{statusLabel(item.latestRun.status)}</span>
      <time dateTime={item.latestRun.createdAt}>
        {new Date(item.latestRun.createdAt).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}
      </time>
    </button>
  ) : (
    <span className="text-xs text-muted-foreground">未运行</span>
  );
}
