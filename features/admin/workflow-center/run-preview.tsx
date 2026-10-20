"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "../detail-drawer";
import { editorApi, workflowApiAssetUrl } from "../workflow-api";
import { getExternalRun } from "@/features/workflow/external-api/api";
import { V2RunNodes } from "@/features/workflow/v2/run-nodes";
import type { WorkflowRun } from "@/features/workflow/types";
import { getRequest, type RequestDetail } from "../request-history/api";
import { RequestDetailView, statusLabel } from "../request-history/request-detail";
import { getCenterRun, type CenterItem } from "./api";

/** 查看仅调用原有已鉴权详情接口；运行权限失效后清空正文，不走宽松替代接口。 */
export function CenterRunPreview({ item, onClose }: { item: CenterItem; onClose: () => void }) {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [legacy, setLegacy] = useState<RequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let denied = false;
    async function refresh() {
      if (!item.latestRun || pending || denied) return;
      pending = true;
      try {
        if (item.source === "template") {
          const value = await getRequest("workflow", item.latestRun.id);
          if (!disposed) setLegacy(value);
        } else {
          const value = item.deletedAt
            ? await getCenterRun(item.source, item.id, item.latestRun.id)
            : item.latestRun.triggerType === "api"
              ? await getExternalRun(item.id, item.latestRun.id)
              : await editorApi.getWorkflowRun(item.id, item.latestRun.id);
          if (!disposed) setRun(value);
        }
        if (!disposed) setError(null);
      } catch (reason) {
        if (!disposed) {
          setRun(null);
          setLegacy(null);
          setError(reason instanceof Error ? reason.message : "查询失败，请重新查询。");
        }
        denied =
          !!reason &&
          typeof reason === "object" &&
          "status" in reason &&
          [401, 403, 404].includes(Number(reason.status));
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [item, retry]);
  return (
    <DetailDrawer
      title="执行详情"
      onClose={onClose}
      actions={
        <Button variant="outline" onPress={() => setRetry((value) => value + 1)}>
          重新查询
        </Button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!run && !legacy && !error && (
        <p role="status" className="text-sm text-muted-foreground">
          正在读取执行详情…
        </p>
      )}
      {legacy && <RequestDetailView detail={legacy} />}
      {run && (
        <section className="space-y-4">
          <div>
            <h3 className="font-medium">{item.name}</h3>
            <p className="mt-1 text-sm">{statusLabel(run.status)}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">任务 {run.id}</p>
          </div>
          {run.error && (
            <p className="whitespace-pre-wrap break-words rounded-lg bg-destructive/5 p-3 text-sm text-destructive">
              {run.error}
            </p>
          )}
          {run.nodes.some((node) =>
            [
              "start",
              "llm",
              "knowledgeRetrieve",
              "knowledgeAnswer",
              "condition",
              "merge",
              "httpRequest",
              "end",
              "parameterExtract",
              "intentClassify",
              "transform",
            ].includes(node.nodeType),
          ) ? (
            <V2RunNodes run={run} />
          ) : (
            <div className="space-y-2">
              {run.nodes.map((node) => (
                <details key={node.nodeId} className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm">
                    {node.nodeType} · {statusLabel(node.status)}
                    {node.isReused && " · 复用结果"}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {node.error && <p className="text-sm text-destructive">{node.error}</p>}
                    {node.output?.texts?.map((text, index) => (
                      <p key={index} className="whitespace-pre-wrap break-words text-sm">
                        {text}
                      </p>
                    ))}
                    {node.output?.images?.map(
                      (url, index) =>
                        /^\/api\/v1\/canvas\/assets\/[0-9a-f-]{36}(?:[/?#]|$)/i.test(url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={index}
                            src={workflowApiAssetUrl(item.id, url)}
                            alt="运行图片结果"
                            className="max-h-72 w-full rounded object-contain"
                          />
                        ),
                    )}
                    {node.output?.videos?.map(
                      (url, index) =>
                        /^\/api\/v1\/canvas\/assets\/[0-9a-f-]{36}(?:[/?#]|$)/i.test(url) && (
                          <video
                            key={index}
                            src={workflowApiAssetUrl(item.id, url)}
                            controls
                            preload="metadata"
                            className="max-h-72 w-full rounded"
                          />
                        ),
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
    </DetailDrawer>
  );
}
