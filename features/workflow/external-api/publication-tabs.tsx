"use client";

import type { ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";

const SECTIONS = [
  { id: "contract", label: "参数契约" },
  { id: "versions", label: "发布版本" },
  { id: "keys", label: "API Key" },
  { id: "example", label: "调用示例" },
  { id: "runs", label: "最近调用" },
] as const;

export type PublicationTab = (typeof SECTIONS)[number]["id"];

/** 发布详情只切换展示区域，接口请求、密钥清理和发布动作仍由上层负责。 */
export function PublicationTabs({
  sections,
  visible,
}: {
  sections: Record<PublicationTab, ReactNode>;
  visible?: readonly PublicationTab[];
}) {
  const tabs = SECTIONS.filter((item) => !visible || visible.includes(item.id));
  return (
    <Tabs defaultSelectedKey={tabs[0]?.id} className="min-w-0">
      <TabList aria-label="API 发布详情" className="flex gap-5 overflow-x-auto border-b">
        {tabs.map(({ id, label }) => (
          <Tab
            key={id}
            id={id}
            className="shrink-0 cursor-pointer border-b-2 border-transparent px-1 py-3 text-sm text-muted-foreground outline-none data-selected:border-primary data-selected:font-medium data-selected:text-primary data-focus-visible:bg-accent"
          >
            {label}
          </Tab>
        ))}
      </TabList>
      {tabs.map(({ id }) => (
        <TabPanel
          key={id}
          id={id}
          className="min-w-0 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sections[id]}
        </TabPanel>
      ))}
    </Tabs>
  );
}
