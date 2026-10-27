"use client";
import { useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Braces, ChevronDown, Loader2, Pin, X } from "lucide-react";
import { Button, Dropdown, Tabs } from "tdesign-react";
import type { WorkspaceTab } from "./location";

export type TabAction = "refresh" | "close" | "others" | "right" | "all";
interface Props {
  tabs: WorkspaceTab[];
  activeKey: string;
  onSelect: (key: string) => void;
  onAction: (action: TabAction, key: string) => void;
  onReorder: (from: number, to: number) => void;
}
function contextMenu(tab: WorkspaceTab) {
  return [
    { content: "刷新当前页签", value: "refresh" },
    { content: "关闭当前页签", value: "close", disabled: tab.pinned },
    { content: "关闭其他页签", value: "others" },
    { content: "关闭右侧页签", value: "right" },
    { content: "关闭全部可关闭页签", value: "all" },
  ];
}
function TabStatus({ tab }: { tab: WorkspaceTab }) {
  if (tab.pinned) return <Pin size={12} aria-hidden />;
  if (tab.running) return <Loader2 size={13} className="animate-spin" aria-label="运行中" />;
  return tab.kind === "workflow" ? <Braces size={13} aria-hidden /> : null;
}
function keyboardIndex(key: string, index: number, length: number) {
  if (key === "ArrowRight") return (index + 1) % length;
  if (key === "ArrowLeft") return (index + length - 1) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return null;
}

/** TDesign 负责卡片导航、溢出滚动和拖拽；显式按钮提供键盘和关闭语义。 */
export function WorkspaceTabs({ tabs, activeKey, onSelect, onAction, onReorder }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  const [dragging, setDragging] = useState(false);
  const order = tabs.map((tab) => tab.key).join(",");
  useLayoutEffect(() => {
    if (!restoreFocus.current) return;
    root.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')?.focus();
    restoreFocus.current = false;
  }, [activeKey, order]);
  function close(key: string) {
    restoreFocus.current = true;
    onAction("close", key);
  }
  function beginDrag(event: DragEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const key = target.querySelector<HTMLElement>("[data-workspace-tab]")?.dataset.workspaceTab;
    if (tabs.find((tab) => tab.key === key)?.pinned) event.preventDefault();
    else setDragging(true);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const selected = event.target.closest<HTMLElement>('[role="tab"]');
    if (!selected) return;
    const index = tabs.findIndex((tab) => tab.key === selected.dataset.workspaceTab);
    const target = keyboardIndex(event.key, index, tabs.length);
    if (target !== null) {
      event.preventDefault();
      restoreFocus.current = true;
      onSelect(tabs[target].key);
    } else if (event.key === "Delete" && !tabs[index].pinned) {
      event.preventDefault();
      close(tabs[index].key);
    }
  }
  function label(tab: WorkspaceTab) {
    return (
      <span
        className="admin-workspace-tab-label"
        title={`${tab.title}${tab.subtitle ? ` · ${tab.subtitle}` : ""}${tab.id ? ` · ${tab.id.slice(0, 8)}` : ""}`}
      >
        <button
          type="button"
          role="tab"
          data-workspace-tab={tab.key}
          aria-selected={tab.key === activeKey}
          aria-controls={`workspace-pane-${tab.key.replaceAll(":", "-")}`}
          tabIndex={tab.key === activeKey ? 0 : -1}
          className="admin-workspace-tab-button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(tab.key);
          }}
        >
          <TabStatus tab={tab} />
          <span className="admin-workspace-tab-title">{tab.title}</span>
          {tab.dirty && (
            <span className="admin-workspace-dirty" aria-label="未保存修改">
              ●
            </span>
          )}
        </button>
        {!tab.pinned && (
          <button
            type="button"
            className="admin-workspace-tab-close"
            aria-label={`关闭 ${tab.title}`}
            onClick={(event) => {
              event.stopPropagation();
              close(tab.key);
            }}
          >
            <X size={12} aria-hidden />
          </button>
        )}
      </span>
    );
  }
  return (
    <div
      ref={root}
      className={`admin-workspace-tabbar${dragging ? " is-dragging" : ""}`}
      role="tablist"
      aria-label="管理页签"
      onKeyDown={keyboard}
      onDragStartCapture={beginDrag}
      onDragEndCapture={() => setDragging(false)}
    >
      <Tabs
        theme="card"
        value={activeKey}
        dragSort
        scrollPosition="auto"
        onChange={(key) => onSelect(String(key))}
        onDragSort={({ currentIndex, targetIndex }) => onReorder(currentIndex, targetIndex)}
        action={
          <Dropdown
            trigger="click"
            placement="bottom-right"
            options={tabs.map((tab) => ({
              content: `${tab.title}${tab.dirty ? " · 未保存" : ""}`,
              value: tab.key,
            }))}
            onClick={(item) => onSelect(String(item.value))}
          >
            <Button variant="text" shape="square" aria-label="已打开页签">
              <ChevronDown size={16} />
            </Button>
          </Dropdown>
        }
      >
        {tabs.map((tab) => (
          <Tabs.TabPanel
            key={tab.key}
            value={tab.key}
            draggable={!tab.pinned}
            label={
              <Dropdown
                trigger="context-menu"
                options={contextMenu(tab)}
                onClick={(item) => onAction(item.value as TabAction, tab.key)}
              >
                {label(tab)}
              </Dropdown>
            }
          />
        ))}
      </Tabs>
    </div>
  );
}
