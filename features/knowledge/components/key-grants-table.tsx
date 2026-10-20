"use client";
import { Button } from "@/components/ui/button";
import type { KnowledgeKeyPermissionsController } from "@/features/knowledge/controllers/use-knowledge-key-permissions";
import styles from "@/features/knowledge/knowledge.module.css";
export function KeyGrantsTable({ controller }: { controller: KnowledgeKeyPermissionsController }) {
  const { data, setPending, setReason, busy } = controller;
  if (!data?.apiKeys) return null;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Key / 工作流</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {data.apiKeys.map((grant) => (
          <tr key={grant.apiKeyId}>
            <td>
              {grant.name}
              <p className="mt-1 text-xs text-muted-foreground">{grant.workflowName}</p>
              <code className="select-all break-all text-xs">{grant.apiKeyId}</code>
            </td>
            <td>{!grant.keyEnabled ? "Key 已失效" : grant.enabled ? "已授权" : "已撤权"}</td>
            <td>
              <Button
                size="sm"
                variant="outline"
                isDisabled={busy || (!grant.keyEnabled && !grant.enabled)}
                onPress={() => {
                  setReason("");
                  setPending({
                    id: grant.apiKeyId,
                    name: grant.name,
                    enabled: !grant.enabled,
                  });
                }}
              >
                {grant.enabled ? "撤销 Key 授权" : "重新授权 Key"}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
