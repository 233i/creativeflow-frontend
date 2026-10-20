import type { EditorSection } from "@/features/workflow/editor-session";

/** 路由和客户端导航共享纯数据，服务端校验不依赖客户端组件引用。 */
export const DETAIL_SECTIONS = [
  { id: "edit", label: "编排与调试" },
  { id: "publications", label: "发布与版本" },
  { id: "runs", label: "运行记录" },
  { id: "access", label: "访问权限" },
  { id: "settings", label: "基本设置" },
] as const satisfies ReadonlyArray<{ id: EditorSection; label: string }>;
export type DetailSection = (typeof DETAIL_SECTIONS)[number]["id"];
