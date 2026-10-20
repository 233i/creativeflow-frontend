"use client";
import { KeyGrantDialog } from "@/features/knowledge/components/key-grant-dialog";
import { KeyGrantsTable } from "@/features/knowledge/components/key-grants-table";
import { useKnowledgeKeyPermissions } from "@/features/knowledge/controllers/use-knowledge-key-permissions";

import { Button } from "@/components/ui/button";
import { formatDate, KnowledgeEmpty, KnowledgeError } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 先选工作流再选 Key 记录；不要求管理员粘贴秘密凭据，授权和审计独立于账号。 */
export function KnowledgeKeyPermissions({ libraryId }: { libraryId: string }) {
  const controller = useKnowledgeKeyPermissions({ libraryId });
  const {
    workflows,
    workflow,
    setWorkflow,
    keys,
    setKeys,
    keyId,
    setKeyId,
    data,
    pending,
    setPending,
    setReason,
    busy,
    loadingKeys,
    setLoadingKeys,
    error,
    setError,
    selected,
  } = controller;
  return (
    <div className="space-y-5">
      <KnowledgeError message={error} />
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <div>
            <h3>外部 API Key 授权</h3>
            <p>仅选择已签发的 Key，不输入秘密凭据。此授权允许该 Key 的工作流检索与回答本库。</p>
          </div>
        </header>
        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
          <label className={styles.field}>
            <span>工作流</span>
            <select
              aria-label="Key 所属工作流"
              className={styles.control}
              value={workflow}
              onChange={(event) => {
                setWorkflow(event.target.value);
                setKeys([]);
                setKeyId("");
                setLoadingKeys(!!event.target.value);
                setError(null);
              }}
            >
              <option value="">选择已发布过的工作流</option>
              {workflows
                .filter((item) => item.version)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · v{item.version}
                  </option>
                ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>API Key</span>
            <select
              aria-label="选择授权 Key"
              className={styles.control}
              disabled={!workflow || loadingKeys}
              value={keyId}
              onChange={(event) => setKeyId(event.target.value)}
            >
              <option value="">{loadingKeys ? "读取中…" : "选择有效 Key"}</option>
              {keys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name} · {key.prefix}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="self-end"
            isDisabled={
              !selected ||
              busy ||
              data?.apiKeys?.some((grant) => grant.apiKeyId === keyId && grant.enabled)
            }
            onPress={() => {
              if (selected) {
                setReason("");
                setPending({ id: keyId, name: selected.name, enabled: true });
              }
            }}
          >
            授权 Key
          </Button>
        </div>
        <p className="px-5 pb-4 text-xs text-muted-foreground">
          没有可用 Key？先到
          <a href="/admin?tab=workflowApis" className="text-primary underline">
            API 管理
          </a>
          发布工作流并创建 Key。签发 Key 本身不授予知识权限。
        </p>
        {!data?.apiKeys?.length ? (
          <KnowledgeEmpty title="暂无 Key 授权">普通账号授权不会继承给外部调用者。</KnowledgeEmpty>
        ) : (
          <div className={styles.tableWrap}>
            <KeyGrantsTable controller={controller} />
          </div>
        )}
      </section>
      <section className={styles.card}>
        <header className={styles.cardHeader}>
          <h3>Key 授权记录</h3>
          <p>最近 100 条，保留调整原因。</p>
        </header>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>时间</th>
                <th>Key</th>
                <th>调整</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {data?.apiKeyAudit?.map((entry, index) => (
                <tr key={index}>
                  <td>{formatDate(entry.createdAt)}</td>
                  <td>
                    {data.apiKeys?.find((grant) => grant.apiKeyId === entry.apiKeyId)?.name ||
                      entry.apiKeyId}
                  </td>
                  <td>{entry.enabled ? "授权" : "撤权"}</td>
                  <td className="max-w-96 break-words">{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {pending && <KeyGrantDialog controller={controller} />}
    </div>
  );
}
