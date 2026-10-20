"use client";
import type { PublicationController } from "../controllers/use-publication-controller";
import { StatusBadge, formatTime } from "./publication-ui";

export function PublicationVersions({ controller }: { controller: PublicationController }) {
  const { deployments } = controller;

  return (
    <section className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">发布版本</h3>
      {deployments.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">暂无发布版本</p>
      ) : (
        <div className="mt-3 space-y-3">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 text-xs last:border-0"
            >
              <div>
                <p className="font-medium">
                  v{deployment.version} · {deployment.description || "暂无说明"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {formatTime(deployment.publishedAt)} · 并发 {deployment.maxConcurrency}
                </p>
              </div>
              <StatusBadge status={deployment.status} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
