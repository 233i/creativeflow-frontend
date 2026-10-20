"use client";

import { FieldSchemaEditor } from "./schema-editor";
import { controlClass } from "./config-styles";
import type { WorkflowV2NodeData } from "./domain/nodes";

/** 脚本节点只编辑语言、源码和有界 JSON 输出契约，不暴露宿主进程或凭据。 */
export function ScriptConfig({
  data,
  onChange,
}: {
  data: WorkflowV2NodeData<"script">;
  onChange: (data: WorkflowV2NodeData<"script">) => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <label className="block space-y-1 text-xs">
          脚本语言
          <select
            aria-label="脚本语言"
            className={controlClass}
            value={data.language ?? "python"}
            onChange={(event) =>
              onChange({ ...data, language: event.target.value as "python" | "javascript" })
            }
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
        <label className="block space-y-1 text-xs">
          超时（秒）
          <input
            aria-label="脚本超时（秒）"
            className={controlClass}
            type="number"
            min={1}
            max={30}
            step={1}
            value={data.timeoutSeconds ?? 10}
            onChange={(event) =>
              onChange({
                ...data,
                timeoutSeconds: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs">
        脚本代码
        <textarea
          aria-label="脚本代码"
          className={`${controlClass} min-h-56 resize-y font-mono text-[11px] leading-5`}
          rows={12}
          maxLength={32768}
          spellCheck={false}
          value={data.code ?? ""}
          onChange={(event) => onChange({ ...data, code: event.target.value })}
        />
      </label>
      <p className="rounded-lg bg-primary/5 p-2 text-[11px] leading-5 text-muted-foreground">
        脚本从标准输入读取一个 JSON 对象，并必须向标准输出写入一个 JSON 对象；日志请写到 stderr。
        运行在无网络的 OpenSandbox 中，不会获得模型密钥、凭据或工作流服务。
      </p>
      <FieldSchemaEditor
        label="脚本输出字段"
        fields={data.outputFields ?? []}
        onChange={(outputFields) => onChange({ ...data, outputFields })}
      />
    </section>
  );
}
