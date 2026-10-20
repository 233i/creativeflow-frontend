"use client";
import { Button } from "@/components/ui/button";
import type { KnowledgePermissionsPanelController } from "@/features/knowledge/controllers/use-knowledge-permissions";
import styles from "@/features/knowledge/knowledge.module.css";
export function AccountGrantsTable({
  controller,
}: {
  controller: KnowledgePermissionsPanelController;
}) {
  const { data, setReason, setPending, busy } = controller;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>账号</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {data?.grants.map((grant) => (
          <tr key={grant.accountId}>
            <td>
              {grant.displayName}
              <p className="mt-1 text-xs text-muted-foreground">{grant.email || grant.accountId}</p>
            </td>
            <td>{!grant.accountEnabled ? "账号已禁用" : grant.enabled ? "已授权" : "已撤权"}</td>
            <td>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy || (!grant.enabled && !grant.accountEnabled)}
                onPress={() => {
                  setReason("");
                  setPending({
                    id: grant.accountId,
                    name: grant.displayName,
                    enabled: !grant.enabled,
                  });
                }}
              >
                {grant.enabled ? "撤销授权" : "重新授权"}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
