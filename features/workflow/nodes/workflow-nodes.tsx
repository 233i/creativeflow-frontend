"use client";

import type { NodeProps } from "@xyflow/react";
import {
  Download,
  ExternalLink,
  FastForward,
  FileImage,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  ScanLine,
  Sparkles,
  Type,
  Upload,
  Video,
} from "lucide-react";
import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import { useT } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useWorkflowEditorEnvironment } from "@/features/workflow/editor-environment";
import { resolveSlot, usableModelSelections, useAiStore } from "@/features/ai/store";
import { AssetLibraryDialog } from "@/features/canvas/asset-library-dialog";
import { ModelPicker, useSelection } from "@/features/ai/model-picker";
import {
  fixedVideoResolution,
  resolveVideoExtensionModel,
  supportsVideoImageInputMode,
  videoParameterOptions,
  videoResolutionLabel,
} from "@/features/ai/video-models";
import { WorkflowNodeShell } from "@/features/workflow/nodes/node-shell";
import { WorkflowVideoFrames } from "@/features/workflow/nodes/workflow-video-frames";
import { useWorkflowStore, useWorkflowStoreApi } from "@/features/workflow/store";
import {
  WORKFLOW_ASPECTS,
  VIDEO_EXTENSION_DURATION_DEFAULT,
  VIDEO_EXTENSION_DURATION_MAX,
  VIDEO_EXTENSION_DURATION_MIN,
  type ImageGenerateWorkflowNodeData,
  type ImageWorkflowNodeData,
  type TextWorkflowNodeData,
  type VideoExtendWorkflowNodeData,
  type VideoGenerateWorkflowNodeData,
  type VideoFrameWorkflowNodeData,
  type WorkflowExternalBindingTarget,
  type WorkflowNodeOutput,
} from "@/features/workflow/types";
import { cn } from "@/lib/utils";

const VIDEO_DURATION_MAX = 15;

export function WorkflowTextNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const update = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as unknown as TextWorkflowNodeData;
  const storedText = nodeData.text ?? "";
  const [draft, setDraft] = useState(storedText);
  const composing = useRef(false);

  useEffect(() => {
    // 撤销、导入或其他外部更新可能替换此节点值。macOS 输入法仍持有组合缓冲区时，
    // 不要把该往返更新写回文本框。
    if (!composing.current) setDraft(storedText);
  }, [storedText]);

  function commit(value: string) {
    setDraft(value);
    // React Flow 会通过受控 `data` 属性协调每次存储写入。macOS 上的 Safari 和 Chromium
    // 会因此取消正在进行的中日韩文字组合，所以只持久化最终组合值。
    if (!composing.current) update(id, { text: value });
  }

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeText")}
      icon={<Type className="size-3.5" />}
      selected={selected}
      outputs={[{ id: "text", label: t("workflow.portText"), type: "text" }]}
    >
      <textarea
        value={draft}
        onChange={(event) => commit(event.target.value)}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          commit(event.currentTarget.value);
        }}
        placeholder={t("workflow.promptPlaceholder")}
        aria-label={t("workflow.nodeText")}
        className="nodrag nowheel h-full w-full resize-none bg-transparent p-3 pt-10 pb-9 text-xs leading-5 outline-none"
      />
      <ApiFloatingInputButton
        nodeId={id}
        nodeType="text"
        field="text"
        type="string"
        label={t("workflow.portPrompt")}
        constraints={{ maxLength: 20_000 }}
      />
    </WorkflowNodeShell>
  );
}

export function WorkflowImageNode({ id, data, selected }: NodeProps) {
  const storeApi = useWorkflowStoreApi();
  const t = useT();
  const { uploadAsset, assetUrl, assets } = useWorkflowEditorEnvironment();
  const update = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as unknown as ImageWorkflowNodeData;
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const uploadPending = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function applyAsset(asset: { url: string; mediaType: string }) {
    if (!mounted.current || !storeApi.getState().nodes.some((node) => node.id === id)) return;
    // 只更新当前节点的图片字段，保留连线、位置及 API 参数绑定；素材库路径不走上传。
    update(id, { assetUrl: asset.url, mediaType: asset.mediaType });
    setError(null);
  }

  async function upload(file: File | undefined) {
    if (!file || !file.type.startsWith("image/") || uploadPending.current) return;
    uploadPending.current = true;
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadAsset(file);
      applyAsset(asset);
    } catch (uploadError) {
      if (mounted.current)
        setError(uploadError instanceof Error ? uploadError.message : t("errors.unknown"));
    } finally {
      uploadPending.current = false;
      if (mounted.current) setUploading(false);
    }
  }

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeImage")}
      icon={<FileImage className="size-3.5" />}
      selected={selected}
      bodyClassName="flex flex-col gap-2 px-2 pt-8 pb-9"
      outputs={[{ id: "image", label: t("workflow.portImage"), type: "image" }]}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        aria-label={t("workflow.localUpload")}
        disabled={uploading}
        className="hidden"
        onChange={(event) => {
          void upload(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        aria-label={t("workflow.uploadImage")}
        disabled={uploading}
        className="nodrag nopan flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
        onClick={() => inputRef.current?.click()}
      >
        {nodeData.assetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(nodeData.assetUrl)}
            alt={t("workflow.portImageInput")}
            className="h-full w-full rounded-lg object-contain"
          />
        ) : (
          <>
            <ImageIcon className="size-5" aria-hidden />
            {t("workflow.imageInputEmpty")}
          </>
        )}
      </button>
      <div className="nodrag nopan grid shrink-0 grid-cols-2 gap-1">
        <Button
          size="xs"
          variant="outline"
          isDisabled={uploading}
          onPress={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-3" aria-hidden />
          )}
          {t(uploading ? "workflow.uploading" : "workflow.localUpload")}
        </Button>
        <Button
          size="xs"
          variant="outline"
          isDisabled={uploading}
          onPress={() => setLibraryOpen(true)}
        >
          <ImageIcon className="size-3" aria-hidden />
          {t("workflow.chooseFromLibrary")}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="max-h-12 shrink-0 overflow-auto text-[0.625rem] text-destructive"
        >
          {error}
        </p>
      )}
      {libraryOpen && (
        <AssetLibraryDialog
          mode="select"
          source={assets}
          selectedAssetUrl={nodeData.assetUrl}
          onSelect={applyAsset}
          onOpenChange={setLibraryOpen}
        />
      )}
      <ApiFloatingInputButton
        nodeId={id}
        nodeType="image"
        field="assetUrl"
        type="image"
        label={t("workflow.portReference")}
      />
    </WorkflowNodeShell>
  );
}

function useImageNodeModel(nodeData: ImageGenerateWorkflowNodeData) {
  const providers = useAiStore((state) => state.providers);
  const slot = useAiStore((state) => state.slots.image);
  const configuredDefault = resolveSlot(providers, slot);
  const imageDefault = configuredDefault?.model.category === "image" ? configuredDefault : null;
  const imageModels = usableModelSelections(providers, "image");
  const fallback = imageDefault ?? (imageModels.length === 1 ? imageModels[0] : null);
  const hasExplicitModel = Boolean(nodeData.providerId || nodeData.modelId);
  const imageProviderIds = new Set(imageModels.map(({ provider }) => provider.id));
  const implicitProviderId = imageProviderIds.size === 1 ? imageModels[0]?.provider.id : undefined;
  const providerId =
    nodeData.providerId ||
    (!hasExplicitModel ? (fallback?.provider.id ?? implicitProviderId) : undefined);
  const modelId = nodeData.modelId || (!hasExplicitModel ? fallback?.model.id : undefined);
  const selectedModel = useSelection(providerId, modelId);
  return { providerId, modelId, selectedModel, fallback, hasExplicitModel };
}

export function WorkflowImageGenerateNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const update = useWorkflowStore((state) => state.updateNodeData);
  const nodeData = data as unknown as ImageGenerateWorkflowNodeData;
  const { providerId, modelId, selectedModel, fallback, hasExplicitModel } =
    useImageNodeModel(nodeData);

  useEffect(() => {
    // 只有一个可用模型时自动写入节点；后台配置的 image 槽位也作为已有工作流的默认值。
    // 一旦节点显式选择，后续后台默认槽位变化不会悄悄改写已保存的工作流。
    if (
      !hasExplicitModel &&
      fallback &&
      (nodeData.providerId !== fallback.provider.id || nodeData.modelId !== fallback.model.id)
    ) {
      update(id, { providerId: fallback.provider.id, modelId: fallback.model.id });
    }
  }, [fallback, hasExplicitModel, id, nodeData.modelId, nodeData.providerId, update]);

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeImageGenerate")}
      icon={<Sparkles className="size-3.5" />}
      selected={selected}
      bodyClassName="pt-13"
      inputs={[
        { id: "prompt", label: t("workflow.portPrompt"), type: "text" },
        { id: "image", label: t("workflow.portReference"), type: "image" },
      ]}
      outputs={[{ id: "image", label: t("workflow.portImage"), type: "image" }]}
    >
      <div className="nodrag nowheel flex h-full flex-col gap-3 overflow-y-auto p-3 text-xs">
        <ModelPicker
          category="image"
          providerId={providerId}
          modelId={modelId}
          onChange={(next) => update(id, next)}
        />
        <ManagedModel name={selectedModel?.model.name} missing={t("workflow.imageModelMissing")} />
        <Field
          label={t("workflow.aspect")}
          api={{
            nodeId: id,
            nodeType: "imageGenerate",
            field: "aspect",
            type: "enum",
            values: [...WORKFLOW_ASPECTS],
          }}
        >
          <select
            value={nodeData.aspect ?? "1:1"}
            onChange={(event) =>
              update(id, { aspect: event.target.value as ImageGenerateWorkflowNodeData["aspect"] })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {WORKFLOW_ASPECTS.map((aspect) => (
              <option key={aspect}>{aspect}</option>
            ))}
          </select>
        </Field>
        <Field
          label={t("workflow.count")}
          api={{
            nodeId: id,
            nodeType: "imageGenerate",
            field: "count",
            type: "integer",
            minimum: 1,
            maximum: 4,
          }}
        >
          <select
            value={nodeData.count ?? 1}
            onChange={(event) => update(id, { count: Number(event.target.value) })}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="质量"
          api={{
            nodeId: id,
            nodeType: "imageGenerate",
            field: "quality",
            type: "enum",
            values: ["auto", "low", "medium", "high"],
          }}
        >
          <select
            value={nodeData.quality ?? "auto"}
            onChange={(event) =>
              update(id, {
                quality: event.target.value as ImageGenerateWorkflowNodeData["quality"],
              })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {["auto", "low", "medium", "high"].map((quality) => (
              <option key={quality}>{quality}</option>
            ))}
          </select>
        </Field>
        <Field
          label="格式"
          api={{
            nodeId: id,
            nodeType: "imageGenerate",
            field: "outputFormat",
            type: "enum",
            values: ["png", "jpeg", "webp"],
          }}
        >
          <select
            value={nodeData.outputFormat ?? "png"}
            onChange={(event) =>
              update(id, {
                outputFormat: event.target.value as ImageGenerateWorkflowNodeData["outputFormat"],
              })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {["png", "jpeg", "webp"].map((format) => (
              <option key={format}>{format}</option>
            ))}
          </select>
        </Field>
        <Field
          label="随机种子"
          api={{
            nodeId: id,
            nodeType: "imageGenerate",
            field: "seed",
            type: "integer",
          }}
        >
          <input
            type="number"
            value={nodeData.seed ?? ""}
            placeholder="随机"
            onChange={(event) =>
              update(id, {
                seed: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
            className="h-8 w-24 rounded-md border bg-background px-2 text-xs"
          />
        </Field>
      </div>
    </WorkflowNodeShell>
  );
}

/** 按模型能力编辑视频参数，并在同一个图片端口上区分参考图片和首尾帧。 */
export function WorkflowVideoGenerateNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const update = useWorkflowStore((state) => state.updateNodeData);
  const providers = useAiStore((state) => state.providers);
  const slot = useAiStore((state) => state.slots.video);
  const selectedModel = resolveSlot(providers, slot);
  const nodeData = data as unknown as VideoGenerateWorkflowNodeData;
  const fixedResolution = selectedModel ? fixedVideoResolution(selectedModel.model.modelKey) : null;
  const { resolutions, durationMin } = videoParameterOptions(
    selectedModel?.model.modelKey ?? "",
    selectedModel?.protocol,
  );
  const isNativeH3 = selectedModel?.protocol === "minimax-h3";
  const aspects = isNativeH3
    ? WORKFLOW_ASPECTS.filter((aspect) => aspect !== "3:2" && aspect !== "2:3")
    : WORKFLOW_ASPECTS;
  const supportsInputMode = selectedModel
    ? supportsVideoImageInputMode(
        selectedModel.model.modelKey,
        selectedModel.protocol,
        selectedModel.provider.builtinId,
      )
    : false;
  const firstLast = nodeData.inputMode === "first-last";

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeVideoGenerate")}
      icon={<Film className="size-3.5" />}
      selected={selected}
      inputs={[
        { id: "prompt", label: t("workflow.portPrompt"), type: "text" },
        {
          id: "image",
          label: t(firstLast ? "workflow.videoFrameInput" : "workflow.portReference"),
          type: "image",
        },
      ]}
      outputs={[{ id: "video", label: t("workflow.portVideo"), type: "video" }]}
      bodyClassName="pt-13"
    >
      <div className="nodrag nowheel flex h-full flex-col gap-3 overflow-y-auto p-3 text-xs">
        <ManagedModel name={selectedModel?.model.name} missing={t("workflow.videoModelMissing")} />
        {(supportsInputMode || firstLast) && (
          <Field
            label={t("workflow.videoInputMode")}
            api={{
              nodeId: id,
              nodeType: "videoGenerate",
              field: "inputMode",
              type: "enum",
              values: supportsInputMode ? ["reference", "first-last"] : ["reference"],
            }}
          >
            <select
              value={nodeData.inputMode ?? "reference"}
              onChange={(event) =>
                update(id, {
                  inputMode: event.target.value as VideoGenerateWorkflowNodeData["inputMode"],
                })
              }
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="reference">{t("workflow.videoInputReference")}</option>
              <option value="first-last" disabled={!supportsInputMode}>
                {t("workflow.videoInputFirstLast")}
              </option>
            </select>
          </Field>
        )}
        {firstLast && supportsInputMode && (
          <WorkflowVideoFrames nodeId={id} reverseFrames={nodeData.reverseFrames} />
        )}
        {supportsInputMode && !firstLast && (
          <p className="text-[0.625rem] leading-4 text-muted-foreground">
            {t("workflow.videoReferenceHint")}
          </p>
        )}
        {firstLast && selectedModel && !supportsInputMode && (
          <p role="alert" className="text-[0.625rem] leading-4 text-destructive">
            {t("workflow.videoModeUnavailable")}
          </p>
        )}
        <Field
          label={t("workflow.aspect")}
          api={{
            nodeId: id,
            nodeType: "videoGenerate",
            field: "aspect",
            type: "enum",
            values: [...aspects],
          }}
        >
          <select
            value={nodeData.aspect ?? "16:9"}
            onChange={(event) =>
              update(id, { aspect: event.target.value as VideoGenerateWorkflowNodeData["aspect"] })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            {aspects.map((aspect) => (
              <option key={aspect}>{aspect}</option>
            ))}
          </select>
        </Field>
        <Field
          label={t("workflow.resolution")}
          api={{
            nodeId: id,
            nodeType: "videoGenerate",
            field: "resolution",
            type: "enum",
            values: [...resolutions],
          }}
        >
          <select
            value={fixedResolution ?? nodeData.resolution ?? "720p"}
            disabled={fixedResolution !== null}
            onChange={(event) =>
              update(id, {
                resolution: event.target.value as VideoGenerateWorkflowNodeData["resolution"],
              })
            }
            className="h-8 rounded-md border bg-background px-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resolutions.map((resolution) => (
              <option key={resolution} value={resolution}>
                {videoResolutionLabel(resolution, selectedModel?.protocol)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={t("workflow.duration")}
          api={{
            nodeId: id,
            nodeType: "videoGenerate",
            field: "duration",
            type: "integer",
            minimum: durationMin,
            maximum: VIDEO_DURATION_MAX,
          }}
        >
          <input
            type="number"
            min={durationMin}
            max={VIDEO_DURATION_MAX}
            value={nodeData.duration ?? 5}
            onChange={(event) => {
              const duration = Number(event.target.value);
              if (
                Number.isInteger(duration) &&
                duration >= durationMin &&
                duration <= VIDEO_DURATION_MAX
              ) {
                update(id, { duration });
              }
            }}
            className="h-8 w-20 rounded-md border bg-background px-2 text-xs"
          />
        </Field>
        {!isNativeH3 && (
          <Field
            label="随机种子"
            api={{
              nodeId: id,
              nodeType: "videoGenerate",
              field: "seed",
              type: "integer",
            }}
          >
            <input
              type="number"
              value={nodeData.seed ?? ""}
              placeholder="随机"
              onChange={(event) =>
                update(id, {
                  seed: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              className="h-8 w-24 rounded-md border bg-background px-2 text-xs"
            />
          </Field>
        )}
        <Field
          label="水印"
          api={{
            nodeId: id,
            nodeType: "videoGenerate",
            field: "watermark",
            type: "boolean",
          }}
        >
          <input
            type="checkbox"
            checked={nodeData.watermark ?? false}
            onChange={(event) => update(id, { watermark: event.target.checked })}
            className="size-4 accent-primary"
          />
        </Field>
        {!isNativeH3 && (
          <Field
            label="生成音频"
            api={{
              nodeId: id,
              nodeType: "videoGenerate",
              field: "generateAudio",
              type: "boolean",
            }}
          >
            <input
              type="checkbox"
              checked={nodeData.generateAudio ?? false}
              onChange={(event) => update(id, { generateAudio: event.target.checked })}
              className="size-4 accent-primary"
            />
          </Field>
        )}
      </div>
    </WorkflowNodeShell>
  );
}

export function WorkflowVideoExtendNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const update = useWorkflowStore((state) => state.updateNodeData);
  const providers = useAiStore((state) => state.providers);
  const slot = useAiStore((state) => state.slots.video);
  const extensionModel = resolveVideoExtensionModel(providers, slot);
  const nodeData = data as unknown as VideoExtendWorkflowNodeData;

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeVideoExtend")}
      icon={<FastForward className="size-3.5" />}
      selected={selected}
      inputs={[
        { id: "prompt", label: t("workflow.portPrompt"), type: "text" },
        { id: "video", label: t("workflow.portVideoInput"), type: "video" },
      ]}
      outputs={[{ id: "video", label: t("workflow.portVideo"), type: "video" }]}
      bodyClassName="pt-13"
    >
      <div className="nodrag nowheel flex h-full flex-col gap-2.5 overflow-y-auto p-3 text-xs">
        <ManagedModel
          name={extensionModel?.model.name}
          missing={t("workflow.videoExtensionModelMissing")}
        />
        <Field label={t("workflow.extensionDuration")}>
          <input
            type="number"
            min={VIDEO_EXTENSION_DURATION_MIN}
            max={VIDEO_EXTENSION_DURATION_MAX}
            value={nodeData.duration ?? VIDEO_EXTENSION_DURATION_DEFAULT}
            onChange={(event) => {
              const duration = Number(event.target.value);
              if (
                Number.isInteger(duration) &&
                duration >= VIDEO_EXTENSION_DURATION_MIN &&
                duration <= VIDEO_EXTENSION_DURATION_MAX
              ) {
                update(id, { duration });
              }
            }}
            className="h-8 w-20 rounded-md border bg-background px-2 text-xs"
          />
        </Field>
        <p className="text-[0.625rem] leading-4 text-muted-foreground">
          {t("workflow.videoExtensionHint")}
        </p>
      </div>
    </WorkflowNodeShell>
  );
}

export function WorkflowVideoFrameNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const nodeData = data as unknown as VideoFrameWorkflowNodeData;
  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeVideoFrame")}
      icon={<ScanLine className="size-3.5" />}
      selected={selected}
      inputs={[{ id: "video", label: t("workflow.portVideoInput"), type: "video" }]}
      outputs={[{ id: "image", label: t("workflow.portImage"), type: "image" }]}
    >
      <div className="nodrag flex h-full flex-col justify-center gap-2 px-3 pt-7 text-xs">
        <Field label={t("workflow.framePosition")}>
          <span className="rounded-md border bg-muted/40 px-2 py-1">
            {nodeData.frame === "last" || !nodeData.frame
              ? t("workflow.frameLast")
              : nodeData.frame}
          </span>
        </Field>
        <p className="text-[0.625rem] leading-4 text-muted-foreground">
          {t("workflow.videoFrameHint")}
        </p>
      </div>
    </WorkflowNodeShell>
  );
}

export function WorkflowOutputNode({ id, selected }: NodeProps) {
  const t = useT();
  const output = useWorkflowNodeOutput(id);
  const images = output?.images ?? [];
  const videos = output?.videos ?? [];
  const results = [
    ...images.map((url) => ({ kind: "image" as const, url })),
    ...videos.map((url) => ({ kind: "video" as const, url })),
  ];

  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeOutput")}
      icon={<ImageIcon className="size-3.5" />}
      selected={selected}
      inputs={[
        { id: "image", label: t("workflow.portImage"), type: "image" },
        { id: "video", label: t("workflow.portVideo"), type: "video" },
      ]}
    >
      <ResultViewer
        results={results}
        emptyKind="mixed"
        emptyTitle={t("workflow.outputEmpty")}
        emptyHint={t("workflow.outputHint")}
        className="pt-14"
      />
    </WorkflowNodeShell>
  );
}

export function WorkflowImageOutputNode({ id, selected }: NodeProps) {
  const t = useT();
  const images = useWorkflowNodeOutput(id)?.images ?? [];
  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeImageOutput")}
      icon={<ImageIcon className="size-3.5" />}
      selected={selected}
      inputs={[{ id: "image", label: t("workflow.portImageInput"), type: "image" }]}
      outputs={[{ id: "image", label: t("workflow.portImage"), type: "image" }]}
    >
      <ResultViewer
        results={images.map((url) => ({ kind: "image", url }))}
        emptyKind="image"
        emptyTitle={t("workflow.imageOutputEmpty")}
        emptyHint={t("workflow.imageOutputHint")}
        className="pt-10"
      />
      <ApiFloatingOutputButton
        nodeId={id}
        nodeType="imageOutput"
        type="image"
        label={t("workflow.nodeImageOutput")}
      />
    </WorkflowNodeShell>
  );
}

export function WorkflowVideoOutputNode({ id, selected }: NodeProps) {
  const t = useT();
  const videos = useWorkflowNodeOutput(id)?.videos ?? [];
  return (
    <WorkflowNodeShell
      nodeId={id}
      title={t("workflow.nodeVideoOutput")}
      icon={<Video className="size-3.5" />}
      selected={selected}
      inputs={[{ id: "video", label: t("workflow.portVideoInput"), type: "video" }]}
      outputs={[{ id: "video", label: t("workflow.portVideo"), type: "video" }]}
    >
      <ResultViewer
        results={videos.map((url) => ({ kind: "video", url }))}
        emptyKind="video"
        emptyTitle={t("workflow.videoOutputEmpty")}
        emptyHint={t("workflow.videoOutputHint")}
        className="pt-10"
      />
      <ApiFloatingOutputButton
        nodeId={id}
        nodeType="videoOutput"
        type="video"
        label={t("workflow.nodeVideoOutput")}
      />
    </WorkflowNodeShell>
  );
}

type ResultItem = { kind: "image" | "video"; url: string };

function ResultViewer({
  results,
  emptyKind,
  emptyTitle,
  emptyHint,
  className,
}: {
  results: ResultItem[];
  emptyKind: "image" | "video" | "mixed";
  emptyTitle: string;
  emptyHint: string;
  className?: string;
}) {
  const t = useT();
  const { assetUrl } = useWorkflowEditorEnvironment();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const currentIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
  const current = results[currentIndex];

  return (
    <div className={cn("nodrag nowheel flex h-full min-h-0 flex-col p-2", className)}>
      {current ? (
        <>
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/25 shadow-inner">
            {current.kind === "image" ? (
              // 对象 URL 和需要认证的素材路由不能使用 next/image。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetUrl(current.url)}
                alt={t("workflow.resultImage")}
                draggable={false}
                className="h-full w-full object-contain"
              />
            ) : (
              <video
                key={current.url}
                src={assetUrl(current.url)}
                controls
                playsInline
                className="h-full w-full object-contain"
              />
            )}

            <span className="absolute top-2 left-2 rounded-md border bg-background/90 px-1.5 py-0.5 text-[0.625rem] font-medium shadow-sm backdrop-blur">
              {current.kind === "image" ? t("workflow.resultImage") : t("workflow.resultVideo")}
              {results.length > 1 ? ` · ${currentIndex + 1}/${results.length}` : ""}
            </span>

            <div className="absolute top-2 right-2 flex gap-1">
              <a
                href={assetUrl(current.url)}
                target="_blank"
                rel="noreferrer"
                aria-label={t("workflow.openResult")}
                title={t("workflow.openResult")}
                className="flex size-6 items-center justify-center rounded-md border bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-muted"
              >
                <ExternalLink className="size-3" aria-hidden />
              </a>
              <a
                href={assetUrl(current.url)}
                download={`creativeflow-workflow-${currentIndex + 1}.${current.kind === "image" ? "png" : "mp4"}`}
                aria-label={t("common.download")}
                title={t("common.download")}
                className="flex size-6 items-center justify-center rounded-md border bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-muted"
              >
                <Download className="size-3" aria-hidden />
              </a>
            </div>
          </div>

          {results.length > 1 && (
            <div className="mt-2 flex h-10 shrink-0 gap-1.5 overflow-x-auto pb-0.5">
              {results.map((result, index) => (
                <button
                  key={`${result.kind}:${result.url}:${index}`}
                  type="button"
                  aria-label={t("workflow.selectResult", { index: index + 1 })}
                  aria-pressed={index === currentIndex}
                  className={cn(
                    "relative flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 transition",
                    index === currentIndex
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border opacity-65 hover:opacity-100",
                  )}
                  onClick={() => setSelectedIndex(index)}
                >
                  {result.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assetUrl(result.url)}
                      alt=""
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="absolute right-0.5 bottom-0 rounded bg-background/85 px-1 text-[0.5rem] tabular-nums">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/15 px-6 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {emptyKind === "video" ? (
              <Video className="size-4" aria-hidden />
            ) : (
              <ImageIcon className="size-4" aria-hidden />
            )}
          </span>
          <p className="text-xs font-medium text-foreground">{emptyTitle}</p>
          <p className="text-[0.625rem] leading-relaxed text-muted-foreground">{emptyHint}</p>
        </div>
      )}
    </div>
  );
}

function useWorkflowNodeOutput(nodeId: string): WorkflowNodeOutput | undefined {
  return useWorkflowStore(
    (state) => state.run?.nodes.find((node) => node.nodeId === nodeId)?.output ?? undefined,
  );
}

function ManagedModel({ name, missing }: { name?: string; missing: string }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2 py-1.5">
      <span className={name ? "text-foreground" : "text-destructive"}>{name ?? missing}</span>
    </div>
  );
}

type ApiField = {
  nodeId: string;
  nodeType: "imageGenerate" | "videoGenerate";
  field: string;
  type: "integer" | "boolean" | "enum";
  minimum?: number;
  maximum?: number;
  values?: readonly string[];
};

function Field({
  label,
  children,
  api,
}: {
  label: string;
  children: React.ReactNode;
  api?: ApiField;
}) {
  const control = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { "aria-label": label })
    : children;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
        <span>{label}</span>
        {api && (
          <ApiBindingButton
            target={{
              kind: "input",
              nodeId: api.nodeId,
              nodeType: api.nodeType,
              field: api.field,
              type: api.type,
              label,
              constraints: {
                ...(api.minimum !== undefined ? { minimum: api.minimum } : {}),
                ...(api.maximum !== undefined ? { maximum: api.maximum } : {}),
                ...(api.values ? { values: [...api.values] } : {}),
              },
            }}
          />
        )}
      </span>
      {control}
    </div>
  );
}

function ApiFloatingInputButton({
  nodeId,
  nodeType,
  field,
  type,
  label,
  constraints,
}: {
  nodeId: string;
  nodeType: "text" | "image";
  field: string;
  type: "string" | "image";
  label: string;
  constraints?: { maxLength?: number };
}) {
  return (
    <div className="absolute right-2 bottom-2 z-10">
      <ApiBindingButton
        target={{
          kind: "input",
          nodeId,
          nodeType,
          field,
          type,
          label,
          constraints,
        }}
      />
    </div>
  );
}

function ApiFloatingOutputButton({
  nodeId,
  nodeType,
  type,
  label,
}: {
  nodeId: string;
  nodeType: "imageOutput" | "videoOutput";
  type: "image" | "video";
  label: string;
}) {
  return (
    <div className="absolute right-2 bottom-2 z-10">
      <ApiBindingButton target={{ kind: "output", nodeId, nodeType, type, label }} />
    </div>
  );
}

function ApiBindingButton({ target }: { target: WorkflowExternalBindingTarget }) {
  const { canManageApi } = useWorkflowEditorEnvironment();
  const open = useWorkflowStore((state) => state.openBinding);
  const binding = useWorkflowStore((state) =>
    target.kind === "input"
      ? state.externalApi.inputs.find(
          (item) => item.target.nodeId === target.nodeId && item.target.field === target.field,
        )
      : state.externalApi.outputs.find((item) => item.nodeId === target.nodeId),
  );
  if (!canManageApi) return null;
  return (
    <button
      type="button"
      title={binding ? `API · ${binding.key}` : "暴露为 API 参数"}
      aria-label={binding ? `API · ${binding.key}` : "暴露为 API 参数"}
      className={cn(
        "nodrag inline-flex h-6 max-w-28 items-center gap-1 rounded border px-1.5 text-[0.625rem] font-medium transition",
        binding
          ? "border-primary/35 bg-primary/10 text-primary"
          : "border-border bg-background/85 text-muted-foreground hover:text-foreground",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        open(target);
      }}
    >
      <Link2 className="size-2.5 shrink-0" aria-hidden />
      <span className="truncate">{binding ? `API · ${binding.key}` : "API"}</span>
    </button>
  );
}
