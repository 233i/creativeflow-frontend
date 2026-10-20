"use client";
import { useRouter } from "next/navigation";
import { useT } from "@/components/providers/i18n-provider";
import {
  Activity,
  ArrowLeft,
  Braces,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Rocket,
  Save,
  Settings2,
  Square,
  Upload as UploadIcon,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { StudioHeader } from "@/components/layout/studio-header";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthMenu } from "@/features/auth/auth-menu";
import { WorkflowProjectMenu } from "../project-menu";
import { WorkflowDetailHeader, useWorkflowDetail } from "../editor-session";
import type * as api from "../api";
import { cn } from "@/lib/utils";
import type { MediaEditorModel } from "../controllers/use-media-editor";
type ToolbarProps = { editor: MediaEditorModel };
export function MediaToolbar({ editor }: ToolbarProps) {
  return (
    <WorkflowDetailHeader>
      <StudioHeader>
        <MediaIdentity editor={editor} />
        <div className="hidden flex-1 sm:block" />
        <SaveStatus state={editor.draft.state.status} />
        <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
          <DocumentActions editor={editor} />
          <ExecutionActions editor={editor} />
        </div>
      </StudioHeader>
    </WorkflowDetailHeader>
  );
}
function MediaIdentity({ editor }: ToolbarProps) {
  const t = useT();
  const router = useRouter();
  const detail = useWorkflowDetail();
  const { source, session, draft } = editor;
  const { document, setDocument } = session;
  const saveNow = draft.save;
  if (!document) return null;
  return (
    <>
      {!detail && (
        <>
          <Brand className="shrink-0 max-lg:[&>span]:hidden" />
          <div className="h-5 w-px bg-border" />
        </>
      )}
      <div className="flex min-w-0 flex-1 items-center sm:flex-none">
        {source.kind === "workflow" ? (
          <WorkflowProjectMenu
            current={document as api.WorkflowDocument}
            onCurrentChange={setDocument}
          />
        ) : (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={
                detail ? "返回工作流中心" : source.kind === "api" ? "返回 API 列表" : "返回模板列表"
              }
              onPress={() =>
                detail
                  ? detail.leave(detail.returnHref)
                  : router.push(
                      source.kind === "api"
                        ? "/admin?tab=workflowApis"
                        : "/admin?tab=workflowTemplates",
                    )
              }
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <div className="min-w-0 max-w-48 px-1">
              {source.kind === "api" ? (
                <input
                  aria-label={detail ? "工作流名称" : "API 名称"}
                  defaultValue={document.name}
                  maxLength={200}
                  className="w-full min-w-0 bg-transparent text-lg font-semibold outline-none focus:ring-1 focus:ring-ring"
                  onBlur={(event) => {
                    const name = event.currentTarget.value.trim();
                    if (name && name !== document.name) void saveNow(name);
                    else event.currentTarget.value = document.name;
                  }}
                />
              ) : (
                <p className="truncate text-lg font-semibold">{document.name}</p>
              )}
              <p className="hidden text-xs text-muted-foreground md:block">
                {source.kind === "api" ? "媒体创作" : "媒体创作 · 历史模板来源"}
              </p>
            </div>
          </>
        )}
      </div>
      {!detail && (
        <span className="hidden rounded-md bg-accent px-2 py-1 text-xs font-medium text-primary lg:inline-flex">
          {source.kind === "api"
            ? "API 编辑与调试"
            : source.kind === "template"
              ? "模板编辑"
              : t("workflow.modeBadge")}
        </span>
      )}
    </>
  );
}
function SaveStatus({ state: saveState }: { state: MediaEditorModel["draft"]["state"]["status"] }) {
  const t = useT();
  return (
    <span
      role="status"
      className={cn(
        "text-xs",
        saveState === "failed" ? "text-destructive" : "hidden text-muted-foreground lg:inline",
      )}
    >
      {saveState === "saving"
        ? t("canvas.saving")
        : saveState === "failed"
          ? t("canvas.saveFailed")
          : t("canvas.saved")}
    </span>
  );
}
function DocumentActions({ editor }: ToolbarProps) {
  const t = useT();
  const detail = useWorkflowDetail();
  const { source, draft, runs, partial, template, files, panels } = editor;
  const { run, active } = runs;
  const saveNow = draft.save;
  const { openMetadata: openTemplateMetadata } = template;
  const { runButton, inspectorOpen, setInspectorOpen, setPublishPanelOpen } = panels;
  const partialRerunSelecting = !!partial.selection;
  const { inputRef, exportFile } = files;
  return (
    <>
      {detail && (
        <Button size="sm" variant="outline" onPress={() => void saveNow()}>
          <Save className="size-3.5" />
          保存
        </Button>
      )}
      {detail && (
        <Button size="sm" variant="outline" onPress={() => detail.select("runs")}>
          运行记录
        </Button>
      )}
      {detail && (
        <Button
          ref={runButton}
          size="sm"
          variant="outline"
          isDisabled={!run}
          aria-expanded={inspectorOpen}
          onPress={() => setInspectorOpen(!inspectorOpen)}
        >
          <Activity className="size-3.5" />
          执行详情
        </Button>
      )}
      <HeaderAction icon={Download} label={t("workflow.exportWorkflow")} onPress={exportFile} />
      {source.kind === "api" && (
        <HeaderAction
          icon={Braces}
          label={detail ? "发布" : "发布 API"}
          isDisabled={active || partialRerunSelecting}
          onPress={() => (detail ? detail.select("publications") : setPublishPanelOpen(true))}
        />
      )}
      {source.kind === "template" && (
        <HeaderAction
          icon={Settings2}
          label="模板信息"
          isDisabled={active || partialRerunSelecting}
          onPress={() => (detail ? detail.select("settings") : void openTemplateMetadata())}
        />
      )}
      <HeaderAction
        icon={UploadIcon}
        label={t("workflow.importWorkflow")}
        isDisabled={active || partialRerunSelecting}
        onPress={() => inputRef.current?.click()}
      />
    </>
  );
}
function ExecutionActions({ editor }: ToolbarProps) {
  const t = useT();
  const detail = useWorkflowDetail();
  const { source, runs, actions, partial, template } = editor;
  const { active } = runs;
  const { runAction, execute, cancel } = actions;
  const { publishing, publish: publishTemplate } = template;
  const partialRerunSelecting = !!partial.selection;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        aria-label={t("workflow.validate")}
        className="px-2 sm:px-2.5"
        isDisabled={partialRerunSelecting}
        onPress={() => actions.validate()}
      >
        <CheckCircle2 className="size-3.5" />
        <span className="hidden sm:inline">{t("workflow.validate")}</span>
      </Button>
      {active ? (
        <Button
          size="sm"
          variant="destructive"
          aria-label={t("workflow.stop")}
          className="px-2 sm:px-2.5"
          isDisabled={actions.busy}
          onPress={() => void cancel()}
        >
          <Square className="size-3" />
          <span className="hidden sm:inline">{t("workflow.stop")}</span>
        </Button>
      ) : (
        <Button
          size="sm"
          aria-label={t("workflow.run")}
          className="px-2 sm:px-2.5"
          isDisabled={actions.busy || partialRerunSelecting}
          onPress={() => void execute()}
        >
          {runAction === "restart" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {detail ? "运行" : source.kind !== "workflow" ? "运行调试" : t("workflow.run")}
          </span>
        </Button>
      )}
      {source.kind === "template" ? (
        <Button
          size="sm"
          variant="outline"
          aria-label="发布模板"
          className="px-2 sm:px-2.5"
          isDisabled={active || publishing || partialRerunSelecting}
          onPress={() => (detail ? detail.select("publications") : void publishTemplate())}
        >
          {publishing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          <span className="hidden sm:inline">发布</span>
        </Button>
      ) : source.kind === "workflow" ? (
        <AuthMenu compact />
      ) : null}
    </>
  );
}
function HeaderAction({
  icon: Icon,
  label,
  onPress,
  isDisabled,
}: {
  icon: typeof Download;
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <TooltipTrigger>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={label}
        isDisabled={isDisabled}
        onPress={onPress}
      >
        <Icon className="size-3.5" aria-hidden />
      </Button>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
