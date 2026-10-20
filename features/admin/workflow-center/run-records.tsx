"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { editorApi } from "../workflow-api";
import { useAdminQuery } from "../admin-query";
import { statusLabel } from "../request-history/request-detail";
import {
  getCenterRun,
  getCenterRunSnapshot,
  listCenterRuns,
  type CenterItem,
  type CenterRun,
  type CenterRunPage,
} from "./api";
import { CenterRunPreview } from "./run-preview";
import { ReadonlyWorkflowGraph } from "@/features/workflow/readonly-graph";
import { getExternalRun, getExternalRunSnapshot } from "@/features/workflow/external-api/api";
import type { WorkflowGraph, WorkflowRun } from "@/features/workflow/types";
import { V2Inspector } from "@/features/workflow/v2/inspector";

/** 只分页读取安全摘要，选中后走原授权详情；切换历史不会写入编辑中的草稿。 */
export function WorkflowRunRecords({ item }: { item: CenterItem }) {
  const [params, update] = useAdminQuery();
  const status = params.get("runStatus") ?? "";
  const limit = params.get("runSize") === "50" ? 50 : 20;
  const pageNumber = Math.max(
    1,
    Math.min(1000000, Number.parseInt(params.get("runPage") ?? "1", 10) || 1),
  );
  const queryKey = `${item.source}:${item.id}:${status}:${pageNumber}:${limit}`;
  const [data, setData] = useState<{ key: string; page: CenterRunPage } | null>(null);
  const page = data?.key === queryKey ? data.page : null;
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selection, setSelection] = useState<{ key: string; run: CenterRun } | null>(null);
  const selected = selection?.key === queryKey ? selection.run : null;
  const setSelected = (run: CenterRun | null) => setSelection(run ? { key: queryKey, run } : null);
  const inspectId = params.get("inspectRun");
  const historical = useMemo<CenterRun | null>(
    () =>
      inspectId && /^[0-9a-f-]{36}$/i.test(inspectId)
        ? {
            id: inspectId,
            workflowId: item.id,
            triggerType: params.get("runTrigger") === "api" ? "api" : "interactive",
            status: "",
            createdAt: "",
          }
        : null,
    [inspectId, item.id, params],
  );
  const selectedItem = useMemo(
    () => (selected ? { ...item, latestRun: selected } : null),
    [item, selected],
  );
  useEffect(() => {
    const abort = new AbortController();
    let disposed = false;
    void listCenterRuns(item.source, item.id, status, (pageNumber - 1) * limit, limit, abort.signal)
      .then((value) => {
        if (!disposed) {
          setData({ key: queryKey, page: value });
          setError(null);
        }
      })
      .catch((reason) => {
        if (!disposed) {
          setData(null);
          setSelection(null);
          setError(reason instanceof Error ? reason.message : "读取运行记录失败。");
        }
      });
    return () => {
      disposed = true;
      abort.abort();
    };
  }, [item.id, item.source, status, pageNumber, limit, refresh, queryKey]);
  if (historical)
    return (
      <HistoricalRun
        key={historical.id}
        item={item}
        reference={historical}
        initialNode={params.get("inspectNode")}
        onClose={() => update({ inspectRun: null, runTrigger: null, inspectNode: null })}
      />
    );
  return (
    <section className="sol-admin-panel p-4" aria-label="工作流运行记录">
      <header className="sol-admin-panel-header">
        <h2>
          运行记录{" "}
          <span className="text-sm font-normal text-muted-foreground">{page?.total ?? "—"}</span>
        </h2>
        <Button variant="outline" onPress={() => setRefresh((value) => value + 1)}>
          刷新记录
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          状态{" "}
          <select
            className="sol-admin-control"
            value={status}
            onChange={(event) => update({ runStatus: event.target.value, runPage: null })}
          >
            <option value="">全部状态</option>
            {["queued", "running", "succeeded", "failed", "cancelled"].map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted-foreground">查看不会重新提交。关闭页面不取消任务。</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="sol-admin-table-scroll">
        <table className="sol-admin-table">
          <thead>
            <tr>
              <th>运行 ID</th>
              <th>来源</th>
              <th>状态</th>
              <th>提交时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {page?.items.map((run) => (
              <tr key={run.id}>
                <td>
                  <button
                    className="text-primary underline"
                    title={run.id}
                    onClick={() => setSelected(run)}
                  >
                    {run.id.slice(0, 8)}
                  </button>
                </td>
                <td title={run.debugNodeId}>
                  {run.debugNodeId
                    ? "单节点调试"
                    : run.triggerType === "api"
                      ? "外部 API"
                      : "整图调试"}
                </td>
                <td>{statusLabel(run.status)}</td>
                <td>
                  <time title={new Date(run.createdAt).toLocaleString()}>
                    {new Date(run.createdAt).toLocaleString()}
                  </time>
                </td>
                <td>
                  <button className="sol-admin-row-action" onClick={() => setSelected(run)}>
                    查看详情
                  </button>
                  <button
                    className="sol-admin-row-action"
                    onClick={() =>
                      update({ inspectRun: run.id, runTrigger: run.triggerType, inspectNode: null })
                    }
                  >
                    历史图
                  </button>
                </td>
              </tr>
            ))}
            {!page && !error && (
              <tr>
                <td colSpan={5} role="status">
                  正在读取运行记录…
                </td>
              </tr>
            )}
            {page?.items.length === 0 && (
              <tr>
                <td colSpan={5}>{status ? "没有匹配的运行" : "尚无运行记录"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="sol-admin-pagination">
        <label>
          每页{" "}
          <select
            className="sol-admin-control"
            aria-label="每页运行条数"
            value={limit}
            onChange={(event) => update({ runSize: event.target.value, runPage: null })}
          >
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>
        <span>
          第 {pageNumber} 页 · 共 {page?.total ?? "—"} 条
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            isDisabled={pageNumber === 1}
            onPress={() => update({ runPage: String(pageNumber - 1) })}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            isDisabled={!page || pageNumber * limit >= page.total}
            onPress={() => update({ runPage: String(pageNumber + 1) })}
          >
            下一页
          </Button>
        </div>
      </footer>
      {selectedItem && (
        <CenterRunPreview
          key={selected!.id}
          item={selectedItem}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

function HistoricalRun({
  item,
  reference,
  initialNode,
  onClose,
}: {
  item: CenterItem;
  reference: CenterRun;
  initialNode?: string | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState<{ graph: WorkflowGraph; run: WorkflowRun } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialNode ?? null);
  const [inspecting, setInspecting] = useState(!!initialNode);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let denied = false;
    async function query() {
      if (pending || denied) return;
      pending = true;
      try {
        const [snapshot, run] =
          item.source === "template" || item.deletedAt
            ? await Promise.all([
                getCenterRunSnapshot(item.source, item.id, reference.id),
                getCenterRun(item.source, item.id, reference.id),
              ])
            : reference.triggerType === "api"
              ? await Promise.all([
                  getExternalRunSnapshot(item.id, reference.id),
                  getExternalRun(item.id, reference.id),
                ])
              : await Promise.all([
                  editorApi.getWorkflowRunSnapshot(item.id, reference.id),
                  editorApi.getWorkflowRun(item.id, reference.id),
                ]);
        if (snapshot.runId !== run.id) throw new Error("运行与图快照不匹配，已停止展示。");
        if (!disposed) {
          setValue({ graph: snapshot.graph, run });
          setError(null);
        }
      } catch (reason) {
        denied =
          !!reason &&
          typeof reason === "object" &&
          "status" in reason &&
          [401, 403, 404].includes(Number(reason.status));
        if (!disposed) {
          setValue(null);
          setSelected(null);
          setError(reason instanceof Error ? reason.message : "历史快照暂不可读，请重新查询。");
        }
      } finally {
        pending = false;
      }
    }
    void query();
    const timer = window.setInterval(() => void query(), 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [item.id, item.source, item.deletedAt, reference, retry]);
  const focused = value?.run.nodes.find((node) => node.nodeId === selected);
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="历史运行只读图">
      <header className="flex flex-wrap items-center gap-3 border-b bg-amber-500/5 p-3 text-sm">
        <Button variant="outline" onPress={onClose}>
          返回运行记录
        </Button>
        <strong>只读版本</strong>
        <span className="min-w-0 flex-1 break-all">运行 {reference.id} · 不影响当前草稿</span>
        <Button variant="outline" onPress={() => setRetry((value) => value + 1)}>
          重新查询
        </Button>
      </header>
      {error && (
        <p role="alert" className="p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!value && !error && (
        <p role="status" className="p-4 text-sm">
          正在核验权限并读取原图…
        </p>
      )}
      {value && (
        <div className="flex min-h-0 flex-1">
          <div className="min-h-80 min-w-0 flex-1">
            <ReadonlyWorkflowGraph
              graph={value.graph}
              run={value.run}
              selectedId={selected ?? undefined}
              onSelect={(id) => {
                setSelected(id);
                setInspecting(true);
              }}
            />
          </div>
          {inspecting && (
            <V2Inspector
              mode="run"
              hasRun
              hasNode={false}
              onMode={() => {}}
              onClose={() => setInspecting(false)}
            >
              <div className="space-y-3 p-4 text-sm">
                <h3 className="font-semibold">
                  {focused
                    ? `${focused.nodeType} · ${statusLabel(focused.status)}`
                    : "选择历史节点"}
                </h3>
                <p className="text-muted-foreground">
                  节点 ID、输入与位置来自本次运行的固定快照，不是当前草稿。
                </p>
                {selected && <p className="break-all font-mono">{selected}</p>}
                {focused?.error && <p className="text-destructive">{focused.error}</p>}
                {selected && (
                  <details>
                    <summary>原节点配置</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        value.graph.nodes.find((node) => node.id === selected)?.data,
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
                {focused && (
                  <details open>
                    <summary>原运行输出</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-all">
                      {JSON.stringify(focused.output, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </V2Inspector>
          )}
        </div>
      )}
    </section>
  );
}
