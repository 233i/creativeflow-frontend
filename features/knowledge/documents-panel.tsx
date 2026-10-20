"use client";
import { useDocumentsPanel } from "@/features/knowledge/controllers/use-knowledge-documents";
import { DocumentsHeader } from "./components/documents-header";
import { DocumentsTable } from "./components/documents-table";

import { DocumentChunksDialog } from "./components/document-chunks-dialog";

import { Button } from "@/components/ui/button";
import { FileText, Loader2, Search, Upload } from "lucide-react";
import { pilotQuotas, type KnowledgeQuotas, type KnowledgeVersion } from "./api";
import { DocumentChangeDialog } from "./document-change-dialog";
import { KnowledgeEmpty, KnowledgeError, versionName } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 元数据列表与正文分页分离；增删改均生成基于明确来源的新版本。 */
export function DocumentsPanel({
  libraryId,
  versionId,
  activeVersion,
  versions,
  onVersionChange,
  onImport,
  onChanged = async () => {},
  quotas = pilotQuotas,
  indexAvailable = true,
}: {
  libraryId: string;
  versionId: string | null;
  activeVersion: string | null;
  versions: KnowledgeVersion[];
  onVersionChange: (id: string) => void;
  onImport: () => void;
  onChanged?: () => Promise<void>;
  quotas?: KnowledgeQuotas;
  indexAvailable?: boolean;
}) {
  const controller = useDocumentsPanel({
    libraryId,
    versionId,
    activeVersion,
    versions,
    onVersionChange,
    onImport,
    onChanged,
    quotas,
    indexAvailable,
  });
  const {
    documents,
    error,
    query,
    setQuery,
    selected,
    setSelected,
    change,
    setChange,
    retry,
    setRetry,
    filtered,
    version,
  } = controller;
  if (!versionId)
    return (
      <div className={styles.card}>
        <KnowledgeEmpty
          title="让知识库拥有第一份文档"
          action={
            <Button className={styles.primary} onPress={onImport}>
              <Upload />
              导入文档
            </Button>
          }
        >
          上传合成测试文档，预览分段后提交入库。当前版本只有在你确认激活后才会用于检索。
        </KnowledgeEmpty>
      </div>
    );
  return (
    <>
      {versionId !== activeVersion && (
        <p className={styles.inlineNotice}>
          正在浏览 <strong>{versionName(versions, versionId)}</strong>{" "}
          的文档。新变更基于此版本，不自动合并其他候选。
        </p>
      )}
      <section className={styles.card} aria-label="版本文档">
        <DocumentsHeader controller={controller} />
        <div className="px-5 py-4">
          <div className={styles.search}>
            <Search size={15} aria-hidden />
            <input
              className={styles.control}
              aria-label="搜索文档"
              placeholder="搜索文档名称"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        {error ? (
          <div className="px-5 pb-5">
            <KnowledgeError message={error} />
            <Button variant="outline" onPress={() => setRetry(retry + 1)}>
              重新读取文档
            </Button>
          </div>
        ) : !documents ? (
          <div className={styles.loading} role="status">
            <Loader2 size={16} className="animate-spin" />
            正在读取文档…
          </div>
        ) : filtered.length === 0 ? (
          <KnowledgeEmpty
            title={query ? "没有匹配的文档" : "此版本暂无文档"}
            icon={<FileText size={24} />}
          >
            {query ? "试试其他文件名，或清空搜索条件。" : "可在索引版本中确认任务状态。"}
          </KnowledgeEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <DocumentsTable controller={controller} />
          </div>
        )}
        <p className="px-5 py-3 text-xs text-muted-foreground">
          只能在就绪版本上新增、更新或移除。删除最后一篇资料请停用知识库；从旧版本移除后，需激活新版本才影响默认检索。
        </p>
      </section>
      {selected && (
        <DocumentChunksDialog
          key={versionId + ":" + selected.id}
          libraryId={libraryId}
          versionId={versionId}
          document={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {change && version && (
        <DocumentChangeDialog
          libraryId={libraryId}
          version={version}
          {...change}
          quotas={quotas}
          onClose={() => setChange(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
