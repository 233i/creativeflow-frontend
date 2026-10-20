"use client";
import { Button } from "@/components/ui/button";
import { DETAIL_SECTIONS } from "@/features/admin/workflow-center/detail-context";
import { isTypedWorkflowGraph } from "@/features/workflow/types";
import { ArrowLeft } from "lucide-react";
import type { WorkflowDetailController } from "../controllers/use-workflow-detail";
export function DetailHeader({ controller }: { controller: WorkflowDetailController }) {
  const {
    setHeader,
    source,
    returnHref,
    section,
    session,
    current,
    publishedTemplate,
    select,
    leave,
  } = controller;
  return (
    <>
      <div ref={setHeader} className="workflow-detail-header shrink-0">
        {" "}
        {(section !== "edit" || !session || publishedTemplate) && (
          <header className="flex flex-wrap items-center gap-3 border-b p-3">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="返回工作流中心"
              onPress={() => leave(returnHref)}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold">{current?.name ?? "工作流详情"}</h1>
              <p className="text-xs text-muted-foreground">
                {isTypedWorkflowGraph(current?.graph) ? "通用编排" : "媒体创作"}
                {source === "template" ? " · 历史模板来源" : ""} ·{" "}
                {publishedTemplate ? "只读版本" : session?.dirty ? "未保存修改" : "已保存"}
              </p>
            </div>
            {session?.dirty && (
              <Button
                variant="outline"
                isDisabled={session.busy}
                onPress={() => void session.save()}
              >
                保存草稿
              </Button>
            )}
            {section !== "edit" && (
              <Button variant="outline" onPress={() => select("edit")}>
                返回编排
              </Button>
            )}
          </header>
        )}
      </div>
      <nav
        aria-label="工作流详情区域"
        className="flex shrink-0 gap-1 overflow-x-auto border-b px-3"
      >
        {DETAIL_SECTIONS.map((tab) => (
          <button
            key={tab.id}
            aria-current={section === tab.id ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm ${section === tab.id ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
