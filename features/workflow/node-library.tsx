"use client";

import { useMemo, useRef, useState } from "react";
import { PanelLeftClose, Plus, Search, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

export interface LibraryItem<Kind extends string> {
  kind: Kind;
  label: string;
  group: string;
  icon: LucideIcon;
  disabled?: boolean;
}

/** 两类画布共享紧凑节点工具条，展开后按当前可用节点分类检索，点击和拖放使用同一节点类型。 */
export function WorkflowNodeLibrary<Kind extends string>({
  items,
  mime,
  onAdd,
  className = "",
}: {
  items: LibraryItem<Kind>[];
  mime: string;
  onAdd: (kind: Kind) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const toggle = useRef<HTMLButtonElement>(null);
  const matches = useMemo(
    () =>
      items.filter((item) =>
        (item.label + " " + item.kind + " " + item.group)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [items, search],
  );
  const visible = expanded ? matches : items;
  return (
    <aside
      aria-label="节点库"
      className={`absolute top-3 left-3 z-20 flex max-h-[calc(100%-5rem)] flex-col rounded-xl border canvas-panel p-1.5 shadow-node ${expanded ? "w-56" : "w-12"} ${className}`}
      onKeyDown={(event) => {
        if (expanded && event.key === "Escape" && !document.querySelector('[aria-modal="true"]')) {
          event.stopPropagation();
          setExpanded(false);
          toggle.current?.focus();
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-1">
        {expanded && <h2 className="pl-2 text-sm font-semibold">添加节点</h2>}
        <Button
          ref={toggle}
          size="icon-sm"
          variant="ghost"
          aria-label={expanded ? "收起节点库" : "展开节点库"}
          aria-expanded={expanded}
          className="size-9"
          onPress={() => setExpanded(!expanded)}
        >
          {expanded ? <PanelLeftClose className="size-4" /> : <Plus className="size-4" />}
        </Button>
      </header>
      {expanded && (
        <label className="relative my-2">
          <Search className="absolute top-2.5 left-2 size-4 text-muted-foreground" />
          <input
            autoFocus
            aria-label="搜索节点"
            placeholder="搜索节点"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full rounded-md border bg-background pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      )}
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {visible.map((item, index) => (
          <div key={item.kind}>
            {expanded && (index === 0 || visible[index - 1].group !== item.group) && (
              <h3 className="px-2 pt-3 pb-1 text-xs text-muted-foreground">{item.group}</h3>
            )}
            <div
              draggable={!item.disabled}
              onDragStart={(event) => {
                if (item.disabled) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.setData(mime, item.kind);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <TooltipTrigger>
                <Button
                  size={expanded ? "sm" : "icon-sm"}
                  variant="ghost"
                  aria-label={item.label}
                  isDisabled={item.disabled}
                  className={
                    expanded
                      ? "h-10 w-full justify-start gap-2"
                      : "my-0.5 size-9 cursor-grab active:cursor-grabbing"
                  }
                  onPress={() => onAdd(item.kind)}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {expanded && item.label}
                </Button>
                <Tooltip placement="right">{item.label}</Tooltip>
              </TooltipTrigger>
            </div>
          </div>
        ))}
        {expanded && matches.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">没有匹配的节点</p>
        )}
      </div>
    </aside>
  );
}
