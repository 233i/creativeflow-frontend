"use client";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import { Download, Loader2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterActionsCell({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  return (
    <td>
      <CenterActionsContent controller={controller} item={item} />
    </td>
  );
}

/** 可嵌入 TDesign Table 单元格的操作内容。 */
export function CenterActionsContent({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  const { router, href, setDeleting, busyId, withDocument } = controller;
  return (
    item.deletedAt ? (
      <Link className="py-2 text-xs text-primary" href={href(item, "runs")}>
        查看运行历史
      </Link>
    ) : (
      <div className="flex items-center justify-end gap-2">
        <Link className="py-2 text-xs text-primary" href={href(item)}>
          {item.source === "template" && item.templateStatus === "published" ? "查看" : "编辑"}
        </Link>
        <Link className="py-2 text-xs text-primary" href={href(item, "publications")}>
          发布
        </Link>
        <MenuTrigger>
          <AriaButton
            className="inline-flex size-8 items-center justify-center rounded hover:bg-muted"
            aria-label={`${item.name} 更多操作`}
            isDisabled={busyId !== null}
          >
            {busyId === item.source + item.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal size={16} />
            )}
          </AriaButton>
          <Popover className="z-50 min-w-40 rounded-lg border bg-popover p-1 shadow-panel">
            <Menu
              aria-label="工作流操作"
              className="outline-none"
              onAction={(key) => {
                if (key === "copy" || key === "export") void withDocument(item, key);
                else if (key === "delete") setDeleting(item);
                else router.push(href(item, "settings"));
              }}
            >
              <MenuItem
                id="copy"
                className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-focused:bg-accent"
              >
                复制为新工作流
              </MenuItem>
              <MenuItem
                id="export"
                className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-focused:bg-accent"
              >
                <Download className="mr-2 inline size-3.5" />
                导出
              </MenuItem>
              <MenuItem
                id="settings"
                className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-focused:bg-accent"
              >
                基本设置
              </MenuItem>
              <MenuItem
                id="delete"
                className="cursor-pointer rounded px-3 py-2 text-sm text-destructive outline-none data-focused:bg-destructive/10"
              >
                删除工作流
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    )
  );
}
