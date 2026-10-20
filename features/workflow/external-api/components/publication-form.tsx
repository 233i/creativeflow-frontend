"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicationController } from "@/features/workflow/external-api/controllers/use-publication-controller";
import { Loader2, Rocket } from "lucide-react";
export function PublicationForm({ controller }: { controller: PublicationController }) {
  const {
    manifest,
    page,
    description,
    setDescription,
    maxConcurrency,
    setMaxConcurrency,
    loading,
    action,
    setFormDirty,
    dirtyRef,
    publish,
    current,
  } = controller;
  return (
    <>
      {" "}
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_10rem_auto] md:items-end">
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium">用途说明</span>
          <Input
            disabled={action !== null || loading}
            value={description}
            maxLength={1000}
            onChange={(event) => {
              dirtyRef.current = true;
              setFormDirty(true);
              setDescription(event.target.value);
            }}
            placeholder="例如：根据商品图片生成 10 秒宣传视频"
          />
        </label>
        <label className="grid gap-1.5 text-xs">
          <span className="font-medium">最大并发数</span>
          <Input
            disabled={action !== null || loading}
            type="number"
            min={1}
            max={32}
            value={maxConcurrency}
            onChange={(event) => {
              dirtyRef.current = true;
              setFormDirty(true);
              setMaxConcurrency(Math.max(1, Math.min(32, Number(event.target.value) || 1)));
            }}
          />
        </label>
        <Button
          isDisabled={action !== null || manifest.outputs.length === 0}
          onPress={() => void publish()}
        >
          {action === "publish" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Rocket className="size-4" />
          )}
          {page ? "确认发布" : current ? "发布新版本" : "发布 API"}
        </Button>
      </div>
      {manifest.outputs.length === 0 && (
        <p className="mt-2 text-xs text-destructive">
          {manifest.mode === "typed"
            ? "请先配置结束节点的输出字段。"
            : "请先在至少一个图片/视频输出节点上设置 API 输出。"}
        </p>
      )}
      {manifest.mode === "typed" && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          发布会固定图、模型配置、知识库版本和外部操作版本。改草稿或激活新索引不会改动已发布版本。模型配置变更需重新发布；资源停用或撤权会阻止执行与结果读取。
        </p>
      )}
    </>
  );
}
