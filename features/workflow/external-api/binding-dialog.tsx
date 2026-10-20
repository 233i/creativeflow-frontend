"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkflowStore } from "@/features/workflow/store";
import type {
  WorkflowExternalBindingTarget,
  WorkflowExternalInputBinding,
  WorkflowExternalOutputBinding,
} from "@/features/workflow/types";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export function WorkflowApiBindingDialog() {
  const target = useWorkflowStore((state) => state.bindingTarget);
  const manifest = useWorkflowStore((state) => state.externalApi);
  const nodes = useWorkflowStore((state) => state.nodes);

  if (!target) return null;

  const existingInput =
    target.kind === "input"
      ? manifest.inputs.find(
          (item) => item.target.nodeId === target.nodeId && item.target.field === target.field,
        )
      : undefined;
  const existingOutput =
    target.kind === "output"
      ? manifest.outputs.find((item) => item.nodeId === target.nodeId)
      : undefined;
  const node = nodes.find((item) => item.id === target.nodeId);
  const fixedValue = target.field ? node?.data[target.field] : undefined;

  return (
    <WorkflowApiBindingForm
      key={`${target.kind}:${target.nodeId}:${target.field ?? "output"}`}
      target={target}
      existingInput={existingInput}
      existingOutput={existingOutput}
      fixedValue={fixedValue}
    />
  );
}

function WorkflowApiBindingForm({
  target,
  existingInput,
  existingOutput,
  fixedValue,
}: {
  target: WorkflowExternalBindingTarget;
  existingInput?: WorkflowExternalInputBinding;
  existingOutput?: WorkflowExternalOutputBinding;
  fixedValue: unknown;
}) {
  const manifest = useWorkflowStore((state) => state.externalApi);
  const close = useWorkflowStore((state) => state.closeBinding);
  const saveInput = useWorkflowStore((state) => state.saveInputBinding);
  const removeInput = useWorkflowStore((state) => state.removeInputBinding);
  const saveOutput = useWorkflowStore((state) => state.saveOutputBinding);
  const removeOutput = useWorkflowStore((state) => state.removeOutputBinding);
  const existing = existingInput ?? existingOutput;
  const [key, setKey] = useState(() => existing?.key ?? suggestKey(target.label, target.field));
  const [label, setLabel] = useState(() => existing?.label ?? target.label);
  const [description, setDescription] = useState(() => existingInput?.description ?? "");
  const [required, setRequired] = useState(
    () => existingInput?.required ?? !hasFixedValue(fixedValue),
  );

  const keyConflict = useMemo(() => {
    return (
      manifest.inputs.some(
        (item) =>
          item.key === key &&
          (item.target.nodeId !== target.nodeId || item.target.field !== target.field),
      ) || manifest.outputs.some((item) => item.key === key && item.nodeId !== target.nodeId)
    );
  }, [key, manifest.inputs, manifest.outputs, target]);

  const valid =
    KEY_PATTERN.test(key) &&
    label.trim().length > 0 &&
    label.trim().length <= 100 &&
    description.length <= 500 &&
    !keyConflict;

  function save() {
    if (!valid) return;
    if (target.kind === "output") {
      saveOutput({
        key,
        label: label.trim(),
        type: target.type as WorkflowExternalOutputBinding["type"],
        nodeId: target.nodeId,
      });
      return;
    }

    saveInput({
      key,
      label: label.trim(),
      description: description.trim(),
      type: target.type as WorkflowExternalInputBinding["type"],
      required,
      ...(existingInput && "default" in existingInput ? { default: existingInput.default } : {}),
      target: { nodeId: target.nodeId, field: target.field! },
      constraints: target.constraints,
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => {
        if (!open) close();
      }}
      className="sm:max-w-lg"
    >
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{target.kind === "input" ? "暴露为 API 参数" : "设为 API 输出"}</DialogTitle>
          <DialogDescription>
            {target.kind === "input"
              ? `外部调用者只能修改已标注的“${target.label}”字段。`
              : "成功运行后，仅返回这里标注的输出节点。"}
          </DialogDescription>
        </DialogHeader>

        <label className="grid gap-1.5 text-xs">
          <span className="font-medium">参数名称</span>
          <Input
            value={key}
            onChange={(event) =>
              setKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
            }
            placeholder="prompt"
            aria-invalid={!KEY_PATTERN.test(key) || keyConflict || undefined}
          />
          <span
            className={
              keyConflict || !KEY_PATTERN.test(key) ? "text-destructive" : "text-muted-foreground"
            }
          >
            {keyConflict ? "参数名称已经被使用" : "使用小写字母、数字和下划线，并以字母开头"}
          </span>
        </label>

        <label className="grid gap-1.5 text-xs">
          <span className="font-medium">显示名称</span>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} />
        </label>

        {target.kind === "input" && (
          <>
            <label className="grid gap-1.5 text-xs">
              <span className="font-medium">参数说明</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={3}
                className="resize-none rounded-lg border bg-transparent px-2.5 py-2 outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                placeholder="告诉外部调用者这个参数应该填写什么"
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
              <span>
                <span className="block font-medium">必填参数</span>
                <span className="mt-0.5 block text-muted-foreground">
                  关闭后，不传参数时沿用节点当前值
                </span>
              </span>
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
          </>
        )}

        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          类型：{typeLabel(target.type)} · 节点字段：{target.nodeId.slice(0, 8)} /{" "}
          {target.field ?? "output"}
        </div>

        <DialogFooter className="mt-1">
          <Button variant="outline" onPress={close}>
            取消
          </Button>
          {(existingInput || existingOutput) && (
            <Button
              variant="destructive"
              onPress={() =>
                target.kind === "input"
                  ? removeInput(target.nodeId, target.field!)
                  : removeOutput(target.nodeId)
              }
            >
              取消暴露
            </Button>
          )}
          <Button isDisabled={!valid} onPress={save}>
            保存
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  );
}

function suggestKey(label: string, field?: string): string {
  const known: Record<string, string> = {
    提示词: "prompt",
    图片: "image",
    参考图: "reference_image",
    首帧: "first_frame",
    比例: "aspect",
    数量: "count",
    质量: "quality",
    格式: "output_format",
    分辨率: "resolution",
    时长: "duration",
    随机种子: "seed",
    水印: "watermark",
    生成音频: "generate_audio",
    输入模式: "input_mode",
    图片输出: "image_result",
    视频输出: "video_result",
  };
  return known[label] ?? field?.replace(/[A-Z]/g, (value) => `_${value.toLowerCase()}`) ?? "result";
}

function typeLabel(type: string): string {
  return (
    (
      {
        string: "文本",
        image: "图片",
        integer: "整数",
        boolean: "布尔值",
        enum: "枚举",
        video: "视频",
      } as Record<string, string>
    )[type] ?? type
  );
}

function hasFixedValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}
