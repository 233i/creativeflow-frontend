"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import type { PublicationController } from "../controllers/use-publication-controller";
import { PublicationSecret } from "./publication-secret";
import { StatusBadge, formatTime } from "./publication-ui";
export function PublicationKeys({ controller }: { controller: PublicationController }) {
  const {
    manifest,
    page,
    apiKeys,
    keyName,
    setKeyName,
    action,
    setKeyDialog,
    createKey,
    revoke,
    current,
  } = controller;
  const secretPreview = controller.newSecret && <PublicationSecret controller={controller} />;
  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4" />
          API Key
        </h3>
      </div>
      {manifest.mode === "typed" && (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Key 仅获得此工作流的调用权。请分别在
          <a className="text-primary underline" href="/admin?tab=knowledge">
            知识库授权
          </a>
          和
          <a className="text-primary underline" href="/admin?tab=httpCredentials">
            凭据授权
          </a>
          中允许此 Key 使用所需资源。不同 Key 不能读取彼此的类型化任务结果。
        </p>
      )}
      {page ? (
        <Button
          className="mt-3"
          isDisabled={!current || action !== null}
          onPress={() => setKeyDialog(true)}
        >
          <KeyRound className="size-4" />
          签发凭证
        </Button>
      ) : (
        <>
          {secretPreview}
          <div className="mt-3 flex gap-2">
            <Input
              value={keyName}
              maxLength={100}
              onChange={(event) => setKeyName(event.target.value)}
              placeholder="Key 名称"
            />
            <Button
              variant="outline"
              isDisabled={!current || action !== null || !keyName.trim()}
              onPress={() => void createKey()}
            >
              {action === "key" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              创建 Key
            </Button>
          </div>
        </>
      )}
      <div className="mt-3 divide-y rounded-lg border">
        {apiKeys.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">暂无 API Key</p>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className="flex items-center gap-3 p-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{key.name}</p>
                <p className="truncate text-muted-foreground">
                  {key.prefix}••••{key.hint} ·{" "}
                  {key.lastUsedAt ? `最后使用 ${formatTime(key.lastUsedAt)}` : "尚未使用"}
                </p>
                {manifest.mode === "typed" && (
                  <p className="mt-1 break-all text-muted-foreground">
                    授权用 ID：<code className="select-all">{key.id}</code>
                  </p>
                )}
              </div>
              <StatusBadge status={key.enabled ? "active" : "revoked"} />
              {key.enabled && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="吊销 Key"
                  onPress={() => void revoke(key.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
