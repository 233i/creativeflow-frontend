"use client";

import { useState } from "react";
import { Alert, Tag } from "tdesign-react";
import type { RequestArtifact, RequestDetail } from "./api";

export { statusLabel } from "@/features/workflow/presentation/run-status";
import { statusLabel } from "@/features/workflow/presentation/run-status";

/** 使用稳定的中文名称区分生成及工作流节点类型。 */
export function kindLabel(kind: string): string {
  return (
    (
      {
        text: "文本",
        image: "图片",
        video: "视频",
        workflow: "工作流",
        textInput: "文本输入",
        imageGenerate: "图片生成",
        videoGenerate: "视频生成",
        videoExtend: "视频延长",
        videoFrame: "提取视频尾帧",
        imageOutput: "图片结果",
        videoOutput: "视频结果",
      } as Record<string, string>
    )[kind] ?? kind
  );
}

/** 缺失或无效时间保持为空，不因旧记录影响整页渲染。 */
export function formatTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

/** 展示执行状态并保留颜色以外的文字说明。 */
export function RequestStatus({ status }: { status: string }) {
  return (
    <Tag
      variant="light"
      theme={
        status === "succeeded"
          ? "success"
          : status === "failed"
            ? "danger"
            : status === "running"
              ? "primary"
              : "default"
      }
    >
      {statusLabel(status)}
    </Tag>
  );
}

/** 只允许后端提供的管理预览路径，防止旧数据中的外部链接自动发起请求。 */
export function artifactUrl(value: string | null): string | null {
  return value &&
    /^\/api\/v1\/admin\/requests\/(canvas|workflow)\/[0-9a-f-]+\/assets\/[0-9a-f-]+$/i.test(value)
    ? value
    : null;
}

/** 预览真实产物；素材删除或读取失败时显示明确占位。 */
function Artifact({ artifact }: { artifact: RequestArtifact }) {
  const [failed, setFailed] = useState(false);
  if (artifact.kind === "text")
    return (
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-background p-4 text-sm">
        {artifact.text || "（空文本）"}
      </pre>
    );
  const url = artifactUrl(artifact.url);
  if (artifact.unavailable || failed || !url)
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-[var(--td-text-color-secondary)]">
        产物已删除或暂不可用
      </div>
    );
  return (
    <figure className="min-w-0 overflow-hidden rounded-lg border bg-background p-3">
      {artifact.kind === "video" ? (
        <video
          className="max-h-96 w-full rounded"
          src={url}
          controls
          preload="metadata"
          onError={() => setFailed(true)}
        />
      ) : (
        // 管理预览必须携带管理员 Cookie，不能交给不带该会话的图片优化代理。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="max-h-96 w-full rounded object-contain"
          src={url}
          alt="图片生成产物"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="mt-2 text-right text-xs">
        <a className="text-[var(--td-brand-color)]" href={url} target="_blank" rel="noreferrer">
          打开原始产物
        </a>
      </figcaption>
    </figure>
  );
}

/** 逐个展示多图、视频和文本产物，空结果不冒充生成成功。 */
function Artifacts({ items }: { items: RequestArtifact[] }) {
  return items.length ? (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <Artifact key={`${item.assetId ?? "text"}-${index}`} artifact={item} />
      ))}
    </div>
  ) : (
    <p className="text-sm text-[var(--td-text-color-secondary)]">暂无产物</p>
  );
}

/** 输入 JSON 作为可展开的运行快照呈现，默认优先展示提示词。 */
function Inputs({ value }: { value: Record<string, unknown> }) {
  const prompt =
    typeof value?.prompt === "string"
      ? value.prompt
      : typeof value?.text === "string"
        ? value.text
        : null;
  return (
    <div className="space-y-2">
      {prompt && (
        <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--td-bg-color-secondarycontainer)] p-3 text-sm">
          {prompt}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-[var(--td-text-color-secondary)]">
          查看输入参数
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    </div>
  );
}

/** 请求详情展示运行时输入与产物，并单独列出工作流每个节点的状态。 */
export function RequestDetailView({ detail }: { detail: RequestDetail }) {
  const { summary } = detail;
  return (
    <div className="space-y-6 pb-8">
      <div className="border-b pb-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">{summary.projectName}</h3>
          <RequestStatus status={summary.status} />
        </div>
        <p className="mt-2 text-sm">
          {summary.userName ?? "历史用户未关联"}
          {summary.email ? ` · ${summary.email}` : ""}
        </p>
        <p className="mt-1 text-sm text-[var(--td-text-color-secondary)]">
          {kindLabel(summary.kind)}
          {summary.modelKey ? ` · ${summary.modelKey}` : ""}
          {summary.providerName ? ` · ${summary.providerName}` : ""}
        </p>
        <p className="mt-2 text-xs text-[var(--td-text-color-secondary)]">
          开始：{formatTime(summary.createdAt)}　结束：{formatTime(summary.finishedAt)}
        </p>
        <p className="mt-2 break-all font-mono text-xs text-[var(--td-text-color-placeholder)]">
          请求：{summary.id}
          {summary.nodeId ? ` · 节点：${summary.nodeId}` : ""}
        </p>
      </div>
      {summary.error && <Alert theme="error" message={summary.error} />}
      {summary.source === "canvas" && (
        <section>
          <h3 className="mb-3 font-medium">请求输入</h3>
          <Inputs value={detail.input} />
        </section>
      )}
      <section>
        <h3 className="mb-3 font-medium">生成产物</h3>
        <Artifacts items={detail.artifacts} />
      </section>
      {detail.nodes.length > 0 && (
        <section>
          <h3 className="mb-3 font-medium">节点明细（{detail.nodes.length}）</h3>
          <div className="space-y-3">
            {detail.nodes.map((node) => (
              <details key={node.id} className="rounded-lg border p-4">
                <summary className="cursor-pointer">
                  <span className="mr-3 font-medium">{kindLabel(node.type)}</span>
                  <RequestStatus status={node.status} />
                  {node.reused && <span className="ml-2 text-xs">复用已有产物</span>}
                  <span className="ml-3 text-xs text-[var(--td-text-color-secondary)]">
                    {node.id}
                  </span>
                </summary>
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-[var(--td-text-color-secondary)]">
                    {formatTime(node.startedAt)} → {formatTime(node.finishedAt)}
                  </p>
                  {node.error && <Alert theme="error" message={node.error} />}
                  <Inputs value={node.input} />
                  <Artifacts items={node.artifacts} />
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
