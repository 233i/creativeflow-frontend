"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Power, RefreshCw } from "lucide-react";
import type { PublicationController } from "../controllers/use-publication-controller";
import { PublicationForm } from "./publication-form";
import { StatusBadge } from "./publication-ui";

export function PublicationStatus({ controller }: { controller: PublicationController }) {
  const { workflowId, page, deployments, loading, action, disable, refresh, current, unpublished } =
    controller;

  return (
    <>
      {" "}
      {page !== "access" && (
        <section className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">发布状态</h3>
                <StatusBadge
                  status={current ? "published" : deployments.length ? "disabled" : "draft"}
                />
                {current && unpublished && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                    草稿更新时间较新，请核对发布内容
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                工作流 ID：<code className="select-all break-all">{workflowId}</code>
                {current
                  ? ` · 当前 v${current.version}`
                  : deployments.length
                    ? " · 已停用"
                    : " · 尚未发布"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={action !== null}
                onPress={() => void refresh()}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                刷新
              </Button>
              {current && (
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={action !== null}
                  onPress={() => void disable()}
                >
                  <Power className="size-3.5" />
                  停用 API
                </Button>
              )}
            </div>
          </div>

          <PublicationForm controller={controller} />
        </section>
      )}
    </>
  );
}
