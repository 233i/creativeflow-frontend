"use client";
import { useKnowledgePanel } from "@/features/knowledge/controllers/use-knowledge-list";
import { KnowledgeLibraryOverview } from "./components/knowledge-library-overview";
import { KnowledgeListToolbar } from "./components/knowledge-list-toolbar";

import { Button } from "@/components/ui/button";
import { Info, Loader2, Plus } from "lucide-react";
import { CreateLibraryDialog } from "./create-library-dialog";
import { KnowledgeDetailPanel } from "./knowledge-detail";
import { KnowledgeEmpty, KnowledgeError } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 列表与详情分离，创建仅在弹窗中进行；所有文档/索引操作沿用原接口与权限。 */
export function KnowledgePanel() {
  const controller = useKnowledgePanel();
  const {
    allModels,
    capabilities,
    setLibraries,
    selected,
    setSelected,
    creating,
    setCreating,
    loading,
    setLoading,
    error,
    setError,
    retry,
    setRetry,
    load,
    chosen,
    labelFor,
  } = controller;
  const createButton = (
    <Button className={styles.primary} onPress={() => setCreating(true)}>
      <Plus />
      新建知识库
    </Button>
  );

  return (
    <div className={styles.page} data-testid="knowledge-management">
      <div className={styles.content}>
        {capabilities?.enabled && selected ? (
          <KnowledgeDetailPanel
            key={selected}
            id={selected}
            indexAvailable={capabilities.indexAvailable}
            quotas={capabilities.quotas}
            modelLabel={chosen ? labelFor(chosen.modelId) : "读取模型信息中"}
            onChanged={load}
            onBack={() => {
              setSelected(null);
              void load().catch((reason) =>
                setError(reason instanceof Error ? reason.message : "刷新失败"),
              );
            }}
          />
        ) : (
          <>
            <header className={styles.header}>
              <div>
                <div className={styles.heading}>
                  <h2>知识库</h2>
                </div>
                <p className={styles.subtitle}>集中管理文档，让每一次检索都有据可查。</p>
              </div>
              {capabilities?.enabled && createButton}
            </header>
            <KnowledgeError message={error} />
            {error && (
              <Button
                variant="outline"
                onPress={() => {
                  setError(null);
                  setLoading(true);
                  setRetry(retry + 1);
                }}
              >
                重新加载
              </Button>
            )}
            {loading ? (
              <div className={styles.loading} role="status">
                <Loader2 size={16} className="animate-spin" />
                正在加载知识库…
              </div>
            ) : !capabilities?.enabled ? (
              !error && (
                <KnowledgeEmpty title="知识库功能未启用">
                  原图片、视频和工作流功能不受影响。
                </KnowledgeEmpty>
              )
            ) : (
              <>
                <div className={styles.notice}>
                  <Info size={16} aria-hidden />
                  <span>管理员维护 · 账号与 Key 分别授权 · 请确认导入资料已获授权。</span>
                  <details>
                    <summary>功能范围</summary>
                    <p>
                      支持 TXT / Markdown、版本入库、检索测试及 AI 工作流知识检索与问答，可对发布
                      Key 独立授权。暂不支持 PDF / DOCX、逐文档增删。
                    </p>
                  </details>
                </div>
                {!capabilities.indexAvailable && (
                  <p className={styles.inlineNotice}>
                    索引服务尚未配置。目前可以创建知识库、预览分段，暂不能提交入库或检索。
                  </p>
                )}
                <KnowledgeListToolbar controller={controller} />
                <KnowledgeLibraryOverview controller={controller} createButton={createButton} />
              </>
            )}
          </>
        )}
        {creating && (
          <CreateLibraryDialog
            models={allModels.filter((model) => model.available)}
            onClose={() => setCreating(false)}
            onCreated={(library) => {
              setLibraries((previous) => [
                library,
                ...previous.filter((item) => item.id !== library.id),
              ]);
              setSelected(library.id);
              setCreating(false);
              setError(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
