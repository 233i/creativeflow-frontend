"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type DetailSection } from "@/features/admin/workflow-center/detail-context";
import type { WorkflowTemplateDocument } from "@/features/workflow/templates-api";
import { useTemplatePublication } from "../controllers/use-template-publication";
export function TemplatePublishing({
  template,
  section,
  onChange,
  beforePublish,
}: {
  template: WorkflowTemplateDocument;
  section: DetailSection;
  onChange: (value: WorkflowTemplateDocument) => void;
  beforePublish?: () => Promise<boolean>;
}) {
  const { confirm, setConfirm, busy, error, apply } = useTemplatePublication({
    template,
    section,
    onChange,
    beforePublish,
  });
  return (
    <section className="h-full space-y-4 overflow-y-auto p-4 text-sm">
      <h2 className="text-lg font-semibold">
        {section === "access" ? "模板访问范围" : "模板发布"}
      </h2>
      <p className="rounded-lg bg-accent p-3">
        历史模板来源 · v{template.version} ·{" "}
        {template.status === "published"
          ? "已上架，只读"
          : template.status === "archived"
            ? "已下架，可编辑"
            : "草稿"}
      </p>
      <p className="text-muted-foreground">
        历史模板沿用原模板库规则。本轮不自动复制成 API，不合并同名记录，也不新增资源授权。
      </p>
      {section === "access" ? (
        <p>上架后按原前台模板库权限展示。复制模板不自动获得知识库、外部接口或素材的使用权限。</p>
      ) : (
        <>
          <p>{template.description || "尚未填写用途说明，可在基本设置中补充。"}</p>
          <p>
            发布版本：v{template.version}；上架时间：
            {template.publishedAt ? new Date(template.publishedAt).toLocaleString() : "尚未上架"}
            。旧模板仅提供当前版本，尚无独立历史版本快照。
          </p>
          <Button
            variant={template.status === "published" ? "outline" : "default"}
            isDisabled={busy}
            onPress={() => setConfirm(true)}
          >
            {template.status === "published" ? "下架模板" : "发布模板"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Dialog
        isOpen={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
        isDismissable={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {template.status === "published" ? "确认下架模板" : "确认发布模板"}
          </DialogTitle>
          <DialogDescription>
            {template.status === "published"
              ? "下架后不再出现在前台模板库，已创建的工作流不受影响。"
              : "发布前保存当前草稿，并按现有校验与模板权限规则上架。"}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" isDisabled={busy} onPress={() => setConfirm(false)}>
            取消
          </Button>
          <Button isDisabled={busy} onPress={() => void apply()}>
            {busy ? "处理中…" : template.status === "published" ? "确认下架模板" : "确认发布模板"}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
