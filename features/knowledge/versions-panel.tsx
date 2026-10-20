"use client";
import { useKnowledgeVersions } from "@/features/knowledge/controllers/use-knowledge-versions";
import { KnowledgeVersionRow } from "./components/knowledge-version-row";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { type KnowledgeVersion } from "./api";
import { CleanupDialog } from "./cleanup-dialog";
import { KnowledgeEmpty, KnowledgeError, versionName } from "./knowledge-ui";
import styles from "./knowledge.module.css";

export function VersionsPanel({
  libraryId,
  versions,
  activeVersion,
  enabled,
  busy,
  run,
  onViewDocuments,
  error = null,
}: {
  libraryId: string;
  versions: KnowledgeVersion[];
  activeVersion: string | null;
  enabled: boolean;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<boolean>;
  onViewDocuments: (versionId: string) => void;
  error?: string | null;
}) {
  const controller = useKnowledgeVersions({
    libraryId,
    versions,
    activeVersion,
    enabled,
    busy,
    run,
    onViewDocuments,
    error,
  });
  const { cleanup, setCleanup } = controller;
  return (
    <>
      <p className={styles.inlineNotice}>
        每次导入都是完整版本。<strong>就绪不等于生效</strong>
        ，只有手动激活后才用于检索；历史版本和已完成的向量检查点会保留。
      </p>
      <section className={styles.card} aria-label="索引版本">
        <div className={styles.cardHeader}>
          <div>
            <h3>
              索引版本 <span className="text-muted-foreground">{versions.length}</span>
            </h3>
            <p>排队 → 向量化 → 保存索引 → 就绪 → 手动激活</p>
          </div>
          <span className={styles.muted}>自动更新状态，不重新提交任务</span>
        </div>
        {versions.length === 0 ? (
          <KnowledgeEmpty title="还没有索引版本">
            从右上角导入文档，这里会显示任务进度与版本记录。
          </KnowledgeEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>版本 / 创建时间</th>
                  <th>状态</th>
                  <th>文档</th>
                  <th>向量检查点</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <KnowledgeVersionRow key={version.id} controller={controller} version={version} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {cleanup && (
        <CleanupDialog
          libraryId={libraryId}
          versionId={cleanup}
          onClose={() => setCleanup(null)}
          onChanged={async () => {
            await run(async () => {});
          }}
        />
      )}
      <VersionConfirmation
        controller={controller}
        versions={versions}
        activeVersion={activeVersion}
        error={error}
        enabled={enabled}
        busy={busy}
      />
    </>
  );
}
function VersionConfirmation({
  controller,
  versions,
  activeVersion,
  error,
  enabled,
  busy,
}: {
  controller: ReturnType<typeof useKnowledgeVersions>;
  versions: KnowledgeVersion[];
  activeVersion: string | null;
  error: string | null;
  enabled: boolean;
  busy: boolean;
}) {
  const { confirmVersion, confirmation, setConfirmation } = controller;
  return (
    confirmation && (
      <Dialog
        isOpen
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
        isDismissable={!busy}
        showCloseButton={!busy}
        className={`${styles.modal} !w-[min(540px,calc(100vw-32px))]`}
      >
        <div className={styles.modalHeader}>
          <DialogTitle>
            {confirmation.type === "activate"
              ? `激活 ${versionName(versions, confirmation.version.id)}？`
              : confirmation.type === "rebuild"
                ? "重建混合索引候选？"
                : "确认重新向量化"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-xs">
            {confirmation.type === "activate"
              ? "切换当前检索使用的完整知识版本"
              : confirmation.type === "rebuild"
                ? "复用已保存向量，不重新调用向量模型"
                : "上次请求的处理结果不明确，请先核对上游状态"}
          </DialogDescription>
        </div>
        <div className={styles.modalBody}>
          <KnowledgeError message={error} />
          <div className={styles.confirmation}>
            {confirmation.type === "activate" ? (
              <>
                <p>
                  激活后，检索会使用此版本的 {confirmation.version.documentCount} 份文档、
                  {confirmation.version.chunkCount} 个片段
                  {activeVersion ? `，替换当前 ${versionName(versions, activeVersion)}` : ""}。
                </p>
                <p>旧版本不会删除，此操作不重新调用模型。</p>
              </>
            ) : confirmation.type === "rebuild" ? (
              <>
                <p>
                  复制该版本正文并构建稠密向量、BM25
                  及标识索引。模型指纹必须一致，已保存向量会复用；模型已变化时会拒绝重建。
                </p>
                <p>
                  新候选就绪后需手动激活，旧版本与已发布工作流固定引用不变；工作流需明确选择新版本才启用混合检索。
                </p>
              </>
            ) : (
              <>
                <p>
                  上次请求可能已被模型受理。此操作会再次发送尚无完整检查点的批次，
                  <strong>可能再次计费</strong>。
                </p>
                <p>已确认的向量仍会复用，不会重新处理全部文档。仅查看状态不会触发重新调用。</p>
              </>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <Button variant="outline" isDisabled={busy} onPress={() => setConfirmation(null)}>
            取消
          </Button>
          <Button isDisabled={busy || !enabled} onPress={() => void confirmVersion()}>
            {busy && <Loader2 className="animate-spin" />}
            {confirmation.type === "activate"
              ? "确认激活"
              : confirmation.type === "rebuild"
                ? "确认创建混合候选"
                : "确认再次调用未完成批次"}
          </Button>
        </div>
      </Dialog>
    )
  );
}
