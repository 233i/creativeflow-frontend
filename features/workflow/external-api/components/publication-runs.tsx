"use client";
import { ExternalRunDetails } from "@/features/workflow/external-api/run-details";
import type { PublicationController } from "../controllers/use-publication-controller";
import { StatusBadge, formatTime } from "./publication-ui";

export function PublicationRuns({ controller }: { controller: PublicationController }) {
  const { workflowId, manifest, runs, inspectedRun, setInspectedRun } = controller;

  return (
    <section className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">最近调用</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">运行 ID</th>
              <th className="pb-2 font-medium">Key</th>
              <th className="pb-2 font-medium">版本</th>
              <th className="pb-2 font-medium">状态</th>
              <th className="pb-2 font-medium">创建时间</th>
              <th className="pb-2 font-medium">错误</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {runs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-muted-foreground">
                  暂无外部调用
                </td>
              </tr>
            ) : (
              runs.map((run) => (
                <tr key={run.runId}>
                  <td className="py-2 font-mono">
                    {manifest.mode === "typed" ? (
                      <button
                        className="text-primary underline"
                        aria-label={`查看运行 ${run.runId}`}
                        onClick={() => setInspectedRun(run.runId)}
                      >
                        {run.runId.slice(0, 8)}
                      </button>
                    ) : (
                      run.runId.slice(0, 8)
                    )}
                  </td>
                  <td>{run.apiKeyName}</td>
                  <td>v{run.version}</td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td>{formatTime(run.createdAt)}</td>
                  <td className="max-w-56 truncate text-destructive">{run.error ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {manifest.mode === "typed" && inspectedRun && (
        <ExternalRunDetails
          key={inspectedRun}
          workflowId={workflowId}
          runId={inspectedRun}
          onClose={() => setInspectedRun(null)}
        />
      )}
    </section>
  );
}
