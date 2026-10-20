"use client";
import type { PublicationController } from "../controllers/use-publication-controller";
import { ContractCard } from "./publication-ui";

export function PublicationContract({ controller }: { controller: PublicationController }) {
  const { current, contract } = controller;

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <p className="text-xs text-muted-foreground md:col-span-2">
        {current ? `当前发布版本 v${current.version} 的参数契约` : "草稿参数预览，发布后生效"}
      </p>
      <ContractCard title="输入参数" empty="尚未暴露输入字段">
        {contract.inputs.map((input) => (
          <div
            key={input.key}
            className="flex items-start justify-between gap-3 border-b py-2 last:border-0"
          >
            <div>
              <code className="text-xs font-semibold">{input.key}</code>
              <p className="text-xs text-muted-foreground">
                {input.label}
                {input.description ? ` · ${input.description}` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
              {input.type}
              {input.required ? " · 必填" : ""}
            </span>
          </div>
        ))}
      </ContractCard>
      <ContractCard title="输出参数" empty="尚未标注输出节点">
        {contract.outputs.map((output) => (
          <div
            key={output.key}
            className="flex items-center justify-between border-b py-2 last:border-0"
          >
            <div>
              <code className="text-xs font-semibold">{output.key}</code>
              <p className="text-xs text-muted-foreground">{output.label}</p>
            </div>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{output.type}</span>
          </div>
        ))}
      </ContractCard>
    </section>
  );
}
