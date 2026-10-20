"use client";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PublicationTabs } from "@/features/workflow/external-api/publication-tabs";
import { Code2, Loader2 } from "lucide-react";
import { PublicationContract } from "./components/publication-contract";
import { PublicationExample } from "./components/publication-example";
import { PublicationKeyDialog } from "./components/publication-key-dialog";
import { PublicationKeys } from "./components/publication-keys";
import { PublicationRuns } from "./components/publication-runs";
import { PublicationStatus } from "./components/publication-status";
import { PublicationSurface } from "./components/publication-ui";
import { PublicationVersions } from "./components/publication-versions";
import { usePublicationController } from "./controllers/use-publication-controller";
import type { PublicationProps } from "./publication-types";
export function WorkflowPublishPanel(props: PublicationProps) {
  const controller = usePublicationController(props);
  const {
    workflowName,
    isOpen,
    page,
    deployments,
    loading,
    action,
    error,
    accessDenied,
    handleOpenChange,
  } = controller;
  return (
    <>
      <PublicationSurface
        page={page}
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        isDismissable={action === null}
        showCloseButton={action === null}
        aria-label="工作流 API"
        className="h-[min(88vh,820px)] sm:max-w-5xl"
      >
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <DialogHeader className="shrink-0 pr-10">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Code2 className="size-5" />
              工作流 API
            </DialogTitle>
            <DialogDescription>
              {workflowName} · 外部系统可按参数契约异步执行当前发布版本
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {error}
              </div>
            )}
            {accessDenied ? (
              <p className="text-sm text-muted-foreground">
                请重新验证管理员身份及资源授权后进入此页面。
              </p>
            ) : loading && deployments.length === 0 ? (
              <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                加载中
              </div>
            ) : (
              <>
                <PublicationStatus controller={controller} />
                <PublicationTabs
                  visible={
                    page === "access"
                      ? ["keys"]
                      : page
                        ? ["contract", "versions", "example"]
                        : undefined
                  }
                  sections={{
                    contract: <PublicationContract controller={controller} />,
                    keys: <PublicationKeys controller={controller} />,
                    example: <PublicationExample controller={controller} />,
                    versions: <PublicationVersions controller={controller} />,
                    runs: <PublicationRuns controller={controller} />,
                  }}
                />
              </>
            )}
          </div>
        </div>
      </PublicationSurface>
      <PublicationKeyDialog controller={controller} />
    </>
  );
}
