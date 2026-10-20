"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Loading, RadioGroup, Space } from "tdesign-react";
import {
  AiApiError,
  getImageGenerationSettings,
  type ImageResponseFormat,
  updateImageGenerationSettings,
} from "@/features/ai/api";

function errorMessage(reason: unknown): string {
  if (reason instanceof AiApiError) {
    if (reason.status === 401) return "管理员会话已失效，请重新登录";
    return reason.details[0] ?? reason.message;
  }

  return reason instanceof Error ? reason.message : "图片生成设置操作失败";
}

export function ImageGenerationSettingsPanel() {
  const [responseFormat, setResponseFormat] = useState<ImageResponseFormat>("url");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const settings = await getImageGenerationSettings();
      setResponseFormat(settings.responseFormat);
    } catch (reason) {
      setLoadError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void getImageGenerationSettings()
      .then(
        (settings) => {
          if (!cancelled) setResponseFormat(settings.responseFormat);
        },
        (reason: unknown) => {
          if (!cancelled) setLoadError(errorMessage(reason));
        },
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const settings = await updateImageGenerationSettings(responseFormat);
      setResponseFormat(settings.responseFormat);
      setMessage({ ok: true, text: "图片返回类型已更新，后续生成任务将立即使用新设置。" });
    } catch (reason) {
      setMessage({ ok: false, text: errorMessage(reason) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="sol-admin-panel">
      <header className="sol-admin-panel-header">
        <div>
          <h2 className="text-base font-semibold">图片生成设置</h2>
          <p className="mt-1 text-sm text-[var(--td-text-color-secondary)]">
            统一控制所有用户调用图片模型时的上游返回类型。
          </p>
        </div>
      </header>

      <div className="sol-admin-panel-scroll">
        <Card
          className="max-w-2xl"
          title="返回类型"
          description="此设置由服务端强制执行，画布用户无法覆盖"
          headerBordered
        >
          {loading ? (
            <Loading size="small" text="正在读取图片生成设置…" />
          ) : loadError ? (
            <Alert
              theme="error"
              message={loadError}
              closeBtn={false}
              operation={
                <Button size="small" variant="text" onClick={() => void load()}>
                  重试
                </Button>
              }
            />
          ) : (
            <Space direction="vertical" size="large" className="w-full">
              <RadioGroup<ImageResponseFormat>
                name="image-response-format"
                value={responseFormat}
                theme="button"
                variant="default-filled"
                options={[
                  { label: "URL", value: "url" },
                  { label: "Base64", value: "base64" },
                ]}
                onChange={(value) => setResponseFormat(value)}
              />

              <Alert
                theme="info"
                title={responseFormat === "url" ? "URL 模式" : "Base64 模式"}
                message={
                  responseFormat === "url"
                    ? "模型先返回临时图片地址，后端再下载并保存到 CreativeFlow 资产库。"
                    : "模型直接返回 Base64 图片数据，后端解码后保存到 CreativeFlow 资产库。"
                }
                closeBtn={false}
              />

              {message && (
                <Alert
                  theme={message.ok ? "success" : "error"}
                  message={message.text}
                  closeBtn={false}
                />
              )}

              <Button theme="primary" loading={saving} onClick={() => void save()}>
                保存设置
              </Button>
            </Space>
          )}
        </Card>
      </div>
    </section>
  );
}
