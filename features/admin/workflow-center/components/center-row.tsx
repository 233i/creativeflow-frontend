"use client";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
import { CenterActionsCell } from "./center-actions-cell";
import { CenterChannelsCell } from "./center-channels-cell";
import { CenterRunCell } from "./center-run-cell";
import { CenterTitleCell } from "./center-title-cell";
export function CenterRow({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  const { selectedColumns } = controller;
  return (
    <tr key={item.source + item.id}>
      <CenterTitleCell controller={controller} item={item} />
      <td>
        <span className="text-xs">{item.kind === "general" ? "通用编排" : "媒体创作"}</span>
      </td>
      <CenterChannelsCell controller={controller} item={item} />
      <td>
        <span
          className="sol-admin-status"
          data-tone={item.deletedAt || item.draftStatus === "saved" ? "default" : "warning"}
        >
          {item.deletedAt
            ? "已删除 · 只读"
            : { saved: "已保存", changed: "未发布修改", unpublished: "尚未发布" }[item.draftStatus]}
        </span>
      </td>
      <CenterRunCell controller={controller} item={item} />
      {selectedColumns.has("updatedAt") && (
        <td>
          <time
            className="text-xs text-muted-foreground"
            dateTime={item.updatedAt}
            title={new Date(item.updatedAt).toLocaleString()}
          >
            {new Date(item.updatedAt).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </time>
        </td>
      )}
      {selectedColumns.has("source") && (
        <td className="text-xs text-muted-foreground">
          {item.source === "template" ? "历史模板来源" : "后台工作流"}
        </td>
      )}
      {selectedColumns.has("nodeCount") && <td>{item.nodeCount}</td>}
      <CenterActionsCell controller={controller} item={item} />
    </tr>
  );
}
