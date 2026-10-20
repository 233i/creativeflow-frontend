"use client";
import { useT } from "@/components/providers/i18n-provider";
import { createCanvas, listCanvases, summarize, type CanvasSummary } from "@/features/canvas/api";
import { lastOpenedCanvas, migrateLegacyCanvas } from "@/features/canvas/sync";
import { CANVAS_TEMPLATES, instantiateCanvasTemplate } from "@/features/canvas/templates";
import { newClientId } from "@/lib/client-id";
import { handshake, storedDeviceId } from "@/lib/device";
import { useEffect, useState } from "react";

const FIRST_VISIT_TEMPLATE = CANVAS_TEMPLATES.find((template) => template.id === "text-to-image")!;
const newCanvasGraphId = newClientId;
export function useCanvasProjects() {
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [projects, setProjects] = useState<CanvasSummary[]>([]);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // 画布存储按设备隔离，因此必须先建立设备身份。
        if (!storedDeviceId()) {
          await handshake();
        }

        // 多文档功能推出前的旧画布会被接管而不是遗弃；获取列表时它已迁移到服务端，
        // 因此也会出现在列表中。
        const migrated = await migrateLegacyCanvas(t("canvas.defaultProject"));

        let { canvases } = await listCanvases();

        // 此设备首次访问。编辑器挂载前必须先有可用画布；具名项目比隐式无名项目更实用，
        // 可让项目菜单从一个有效条目开始，而不是显示空列表。
        if (canvases.length === 0) {
          canvases = [
            summarize(
              await createCanvas(
                t("canvas.defaultProject"),
                instantiateCanvasTemplate(FIRST_VISIT_TEMPLATE, newCanvasGraphId),
              ),
            ),
          ];
        }

        const remembered = lastOpenedCanvas();
        const target =
          migrated ?? canvases.find((canvas) => canvas.id === remembered)?.id ?? canvases[0].id;

        if (!cancelled) {
          setProjects(canvases);
          setCanvasId(target);
        }
      } catch (error) {
        if (!cancelled) {
          setResolveError(error instanceof Error ? error.message : t("errors.unknown"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  return { canvasId, setCanvasId, projects, setProjects, resolveError, t };
}
