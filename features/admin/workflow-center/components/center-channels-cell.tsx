"use client";
import { type CenterItem } from "@/features/admin/workflow-center/api";
import Link from "next/link";
import type { WorkflowCenterController } from "../controllers/use-workflow-center";
export function CenterChannelsCell({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  return (
    <td>
      <CenterChannelsContent controller={controller} item={item} />
    </td>
  );
}

/** 可嵌入 TDesign Table 单元格的发布渠道内容。 */
export function CenterChannelsContent({
  controller,
  item,
}: {
  controller: WorkflowCenterController;
  item: CenterItem;
}) {
  const { href } = controller;
  return (
    <div className="flex flex-wrap gap-1">
      {item.apiStatus !== "none" && (
        <Link
          href={href(item, "publications")}
          className="sol-admin-status"
          data-tone={
            item.apiStatus === "published"
              ? "success"
              : item.apiStatus === "disabled"
                ? "warning"
                : "default"
          }
        >
          API {item.apiVersion ? `v${item.apiVersion} · ` : ""}
          {
            {
              unpublished: "未发布",
              published: "已开放",
              disabled: "已停用",
              none: "—",
            }[item.apiStatus]
          }
        </Link>
      )}
      {item.templateStatus !== "none" && (
        <Link
          href={href(item, "publications")}
          className="sol-admin-status"
          data-tone={item.templateStatus === "published" ? "success" : "default"}
        >
          模板 {item.templateVersion ? `v${item.templateVersion} · ` : ""}
          {{ published: "已上架", draft: "草稿", archived: "已下架", none: "—" }[
            item.templateStatus
          ]}
        </Link>
      )}
    </div>
  );
}
