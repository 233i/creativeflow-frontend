"use client";
import { useKnowledgeDetailPanel } from "@/features/knowledge/controllers/use-knowledge-detail";
import { KnowledgeDetailHeader } from "./components/knowledge-detail-header";
import { KnowledgeSettingsDialog } from "./components/knowledge-settings-dialog";
import { KnowledgeVersionStats } from "./components/knowledge-version-stats";
import { knowledgeVersionView } from "./version-selection";

import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, History, Loader2, Search } from "lucide-react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { pilotQuotas, type KnowledgeQuotas } from "./api";
import { DocumentsPanel } from "./documents-panel";
import { KnowledgeImportPanel } from "./import-panel";
import { CopyId, KnowledgeEmpty, KnowledgeError, versionName } from "./knowledge-ui";
import styles from "./knowledge.module.css";
import { KnowledgePermissionsPanel } from "./permissions-panel";
import { KnowledgeSearchPanel } from "./search-panel";
import { VersionsPanel } from "./versions-panel";

/** 详情只轮询读状态；所有写操作由用户触发并使用同步锁，切换标签不会调用模型。 */
export function KnowledgeDetailPanel({
  id,
  indexAvailable,
  modelLabel,
  onChanged,
  onBack,
  quotas = pilotQuotas,
}: {
  id: string;
  indexAvailable: boolean;
  modelLabel: string;
  onChanged: () => Promise<void>;
  onBack: () => void;
  quotas?: KnowledgeQuotas;
}) {
  const controller = useKnowledgeDetailPanel({
    id,
    indexAvailable,
    modelLabel,
    onChanged,
    onBack,
    quotas,
  });
  const {
    detail,
    error,
    busy,
    tab,
    setTab,
    documentVersion,
    setDocumentVersion,
    importOpen,
    setImportOpen,
    settingsOpen,
    load,
    run,
  } = controller;
  if (!detail)
    return (
      <>
        <Button variant="ghost" className={styles.back} onPress={onBack}>
          <ArrowLeft />
          全部知识库
        </Button>
        <KnowledgeError message={error} />
        {error ? (
          <Button variant="outline" onPress={() => void run(async () => {})}>
            重新读取
          </Button>
        ) : (
          <div className={styles.loading}>
            <Loader2 className="animate-spin" size={16} />
            正在读取知识库…
          </div>
        )}
      </>
    );
  const { library, versions, displayedVersion } = knowledgeVersionView(detail, documentVersion);
  const viewDocuments = (versionId: string) => {
    setDocumentVersion(versionId);
    setTab("documents");
  };

  const view = { ...controller, ...knowledgeVersionView(detail, documentVersion) };
  return (
    <>
      <Button variant="ghost" className={styles.back} onPress={onBack}>
        <ArrowLeft />
        全部知识库
      </Button>
      <KnowledgeDetailHeader controller={view} />
      <KnowledgeError message={error} />
      <KnowledgeVersionStats controller={view} />
      {!library.enabled && (
        <p className={styles.inlineNotice}>
          知识库已停用，文档与检索结果暂不展示。可在右上角「知识库设置」重新启用。
        </p>
      )}
      <Tabs selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
        <TabList aria-label="知识库详情" className={styles.tabs}>
          <Tab id="documents" className={styles.tab}>
            <FileText size={15} />
            文档
          </Tab>
          <Tab id="versions" className={styles.tab}>
            <History size={15} />
            索引版本
          </Tab>
          <Tab id="search" className={styles.tab}>
            <Search size={15} />
            检索测试
          </Tab>
          <Tab id="permissions" className={styles.tab}>
            授权管理
          </Tab>
        </TabList>
        <TabPanel id="documents">
          <div className={styles.twoColumn}>
            <div>
              {library.enabled ? (
                <DocumentsPanel
                  key={`${id}:${displayedVersion}`}
                  libraryId={id}
                  versionId={displayedVersion}
                  activeVersion={library.activeVersion}
                  versions={versions}
                  onVersionChange={setDocumentVersion}
                  onImport={() => setImportOpen(true)}
                  quotas={quotas}
                  indexAvailable={indexAvailable}
                  onChanged={async () => {
                    await load();
                    await onChanged();
                  }}
                />
              ) : (
                <div className={styles.card}>
                  <KnowledgeEmpty title="知识库已停用">
                    重新启用后可以查看文档。已有版本和向量检查点不会被删除。
                  </KnowledgeEmpty>
                </div>
              )}
            </div>
            <aside className={`${styles.card} ${styles.info}`}>
              <h3>知识库信息</h3>
              <p>
                版本预算：{versions.length} / {quotas.maxVersions}；逻辑存储预留：
                {(
                  versions.reduce((sum, item) => sum + (item.reservedBytes ?? 0), 0) / 1048576
                ).toFixed(1)}{" "}
                / {(quotas.maxLibraryReservedBytes / 1048576).toFixed(0)} MiB。
              </p>
              <dl>
                <div>
                  <dt>向量模型</dt>
                  <dd>{modelLabel}</dd>
                </div>
                <div>
                  <dt>检索方式</dt>
                  <dd>向量 / 关键词 / 混合检索 · 可配置重排序</dd>
                </div>
                <div>
                  <dt>可用范围</dt>
                  <dd>管理员及显式授权账号/Key</dd>
                </div>
                <div>
                  <dt>知识库 ID</dt>
                  <dd>
                    <CopyId id={id} />
                  </dd>
                </div>
              </dl>
              <p>支持文档增删改生成新版本；暂不支持 PDF / DOCX。</p>
            </aside>
          </div>
        </TabPanel>
        <TabPanel id="versions">
          <VersionsPanel
            libraryId={id}
            versions={versions}
            activeVersion={library.activeVersion}
            enabled={library.enabled}
            busy={busy}
            run={run}
            onViewDocuments={viewDocuments}
            error={error}
          />
        </TabPanel>
        <TabPanel id="search">
          <KnowledgeSearchPanel
            key={`${id}:${library.activeVersion}:${library.enabled}`}
            libraryId={id}
            activeVersion={library.activeVersion}
            activeName={versionName(versions, library.activeVersion)}
            enabled={library.enabled}
            indexAvailable={indexAvailable}
            indexSchema={
              versions.find((version) => version.id === library.activeVersion)?.indexSchema
            }
          />
        </TabPanel>
        <TabPanel id="permissions">
          <KnowledgePermissionsPanel key={id} libraryId={id} />
        </TabPanel>
      </Tabs>
      {importOpen && library.enabled && (
        <KnowledgeImportPanel
          quotas={quotas}
          libraryId={id}
          libraryName={library.name}
          indexAvailable={indexAvailable}
          onClose={() => setImportOpen(false)}
          onImported={async () => {
            setTab("versions");
            await load();
            await onChanged();
          }}
        />
      )}
      {settingsOpen && <KnowledgeSettingsDialog controller={view} />}
    </>
  );
}
