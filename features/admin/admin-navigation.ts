import {
  Braces,
  Boxes,
  Cpu,
  Globe,
  History,
  Image,
  Library,
  SlidersHorizontal,
  Users,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

export type AdminTab =
  | "workflows"
  | "assets"
  | "users"
  | "requests"
  | "workflowTemplates"
  | "workflowApis"
  | "knowledge"
  | "httpCredentials"
  | "providers"
  | "models"
  | "modelConfig"
  | "imageSettings"
  | "password";

interface AdminNavigationItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
}

/** 导航元数据与展示、认证状态解耦；切换目标由字面量类型约束。 */
export const ADMIN_NAVIGATION: ReadonlyArray<{
  label: string;
  items: readonly AdminNavigationItem[];
}> = [
  {
    label: "工作空间",
    items: [
      { id: "workflows", label: "工作流中心", icon: Braces },
      { id: "requests", label: "运行中心", icon: History },
      { id: "workflowTemplates", label: "模板运营", icon: Library },
    ],
  },
  {
    label: "资源与系统",
    items: [
      { id: "assets", label: "资产中心", icon: FolderOpen },
      { id: "knowledge", label: "知识库", icon: Library },
      { id: "httpCredentials", label: "凭据管理", icon: Globe },
      { id: "providers", label: "渠道管理", icon: Boxes },
      { id: "models", label: "模型管理", icon: Cpu },
      { id: "modelConfig", label: "模型配置", icon: SlidersHorizontal },
      { id: "imageSettings", label: "图片生成设置", icon: Image },
      { id: "users", label: "用户管理", icon: Users },
    ],
  },
];

export function adminTabLabel(tab: AdminTab): string {
  if (tab === "workflowApis") return "工作流中心";
  if (tab === "password") return "修改密码";
  return (
    ADMIN_NAVIGATION.flatMap((group) => group.items).find((item) => item.id === tab)?.label ?? ""
  );
}

/** 后台导航统一留在共享路由；旧的独立地址仍可直接打开。 */
export function adminTabHref(tab: AdminTab): string {
  // 工作区菜单共用 /admin，避免切换时进入独立路由段并重挂载整个后台。
  // /admin/workflows 与 /admin/runs 仍保留，书签和直接访问不受影响。
  if (tab === "workflows") return "/admin?tab=workflows";
  if (tab === "workflowApis") return "/admin/workflows?view=api";
  if (tab === "requests") return "/admin?tab=requests";
  return `/admin?tab=${tab}`;
}

export function parseAdminTab(value: unknown): AdminTab {
  if (value === "workflowApis" || value === "password") return value;
  return ADMIN_NAVIGATION.some((group) => group.items.some((item) => item.id === value))
    ? (value as AdminTab)
    : "workflows";
}
