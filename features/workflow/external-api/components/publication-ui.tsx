"use client";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** 长发布管理可进入详情页；旧入口保留原对话框，不改变发布与密钥接口。 */
export function PublicationSurface({
  page,
  children,
  ...props
}: React.ComponentProps<typeof Dialog> & { page?: "publications" | "access" }) {
  if (page)
    return (
      <section
        aria-label={page === "access" ? "访问权限" : "发布与版本"}
        className="workflow-publication-page flex h-full min-h-0 flex-col p-4"
      >
        {children}
      </section>
    );
  return <Dialog {...props}>{children}</Dialog>;
}

export function ContractCard({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2">
        {hasChildren ? children : <p className="py-3 text-xs text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const positive = ["published", "active", "succeeded", "running"].includes(status);
  const label: Record<string, string> = {
    published: "已发布",
    disabled: "已停用",
    draft: "未发布",
    active: "启用",
    revoked: "已吊销",
    queued: "排队中",
    running: "运行中",
    succeeded: "成功",
    failed: "失败",
    cancelled: "已取消",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
        positive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : status === "queued"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {label[status] ?? status}
    </span>
  );
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
