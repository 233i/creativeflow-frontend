"use client";

import { cn } from "@/lib/utils";

/** 设置面板共享外壳，使所有面板具有一致的滚动和间距。 */

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-8 overflow-y-auto p-6", className)}
    >
      {children}
    </div>
  );
}

export function PanelSection({
  title,
  description,
  children,
  actions,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** 供应商和 MCP 面板使用的双栏主从布局。 */
export function MasterDetail({ list, detail }: { list: React.ReactNode; detail: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 max-sm:flex-col">
      <div className="flex w-52 shrink-0 flex-col border-r bg-muted/20 max-sm:max-h-44 max-sm:w-full max-sm:border-r-0 max-sm:border-b">
        {list}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{detail}</div>
    </div>
  );
}

export function PanelEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** 带标签的表单行。`hint` 用于解释协议继承等不直观字段。 */
export function FormField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}
