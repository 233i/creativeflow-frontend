import type { Metadata } from "next";
import { CanvasPage } from "@/features/canvas/canvas-page";

export const metadata: Metadata = {
  title: "画布",
};

/**
 * 画布就是应用本身，因此位于根路径。
 *
 * 路由组为其提供全出血布局，同时不出现在 URL 中；画布自行解析要打开的文档，
 * 路径中无需包含标识。
 */
export default function Page() {
  return <CanvasPage />;
}
