"use client";
import { AccountGrantDialog } from "@/features/knowledge/components/account-grant-dialog";
import { AccountGrantsTable } from "@/features/knowledge/components/account-grants-table";
import { useKnowledgePermissionsPanel } from "@/features/knowledge/controllers/use-knowledge-permissions";

import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { KnowledgeKeyPermissions } from "./key-permissions";
import { formatDate, KnowledgeEmpty, KnowledgeError } from "./knowledge-ui";
import styles from "./knowledge.module.css";

/** 授权与撤权都是显式确认的独立操作，写入原因；不会代用户发起检索。 */
export function KnowledgePermissionsPanel({ libraryId }: { libraryId: string }) {
  const controller = useKnowledgePermissionsPanel({ libraryId });
  const {
    data,
    users,
    search,
    setSearch,
    account,
    setAccount,
    setReason,
    pending,
    setPending,
    error,
    busy,
    keyMode,
    setKeyMode,
    selected,
  } = controller;
  return (
    <div className="space-y-5">
      <div className={styles.notice}>
        <ShieldCheck size={18} />
        <p>
          账号与 API Key
          分别授权。撤权立即阻止后续执行及旧结果读取，无法撤回对方已保存的内容。发布工作流不自动授予知识访问权。
        </p>
      </div>
      <div className="flex gap-2" aria-label="授权对象类型">
        <Button variant={keyMode ? "outline" : "default"} onPress={() => setKeyMode(false)}>
          普通账号
        </Button>
        <Button variant={keyMode ? "default" : "outline"} onPress={() => setKeyMode(true)}>
          外部 API Key
        </Button>
      </div>
      {keyMode ? (
        <KnowledgeKeyPermissions key={libraryId} libraryId={libraryId} />
      ) : (
        <>
          <KnowledgeError message={error} />
          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <div>
                <h3>授权账号</h3>
                <p>仅返回搜索结果前 100 个账号；无匹配时请缩小关键词。</p>
              </div>
            </header>
            <div className="grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto]">
              <input
                aria-label="搜索授权账号"
                className={styles.control}
                placeholder="搜索用户昵称或邮箱"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setAccount("");
                }}
              />
              <select
                aria-label="选择授权账号"
                className={styles.control}
                value={account}
                onChange={(event) => setAccount(event.target.value)}
              >
                <option value="">选择已注册账号</option>
                {users
                  .filter((user) => user.isEnabled)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} · {user.email || user.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
              <Button
                isDisabled={
                  !selected ||
                  busy ||
                  data?.grants.some((grant) => grant.accountId === account && grant.enabled)
                }
                onPress={() => {
                  if (selected) {
                    setReason("");
                    setPending({ id: account, name: selected.displayName, enabled: true });
                  }
                }}
              >
                添加授权
              </Button>
            </div>
            {data && data.grants.length === 0 ? (
              <KnowledgeEmpty title="暂未授权普通用户">
                管理员可调试，普通用户不会自动获得访问权限。
              </KnowledgeEmpty>
            ) : (
              <div className={styles.tableWrap}>
                <AccountGrantsTable controller={controller} />
              </div>
            )}
          </section>
          <section className={styles.card}>
            <header className={styles.cardHeader}>
              <h3>最近授权记录</h3>
              <p>最近 100 条，保留调整原因。</p>
            </header>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>账号</th>
                    <th>调整</th>
                    <th>原因</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.audit.map((entry, i) => (
                    <tr key={i}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>
                        {data.grants.find((grant) => grant.accountId === entry.accountId)
                          ?.displayName || entry.accountId}
                      </td>
                      <td>{entry.enabled ? "授权" : "撤权"}</td>
                      <td className="max-w-96 break-words">{entry.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {pending && <AccountGrantDialog controller={controller} />}
    </div>
  );
}
