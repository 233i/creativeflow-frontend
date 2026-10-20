"use client";

import { Button } from "@/components/ui/button";
import type { LibraryController } from "../controllers/use-library-controller";
import type { LibrarySection } from "../types";

export function LibraryToolbar({ controller }: { controller: LibraryController }) {
  const { picking, source, filters, commands } = controller;
  const sections: [LibrarySection, string][] = [
    ["mine", "我的素材"],
    ["public", "公共素材"],
  ];
  if (!picking && !source) sections.push(["recycle", "回收站"]);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
      <div className="flex gap-1" role="tablist" aria-label="素材范围">
        {sections.map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filters.section === value ? "secondary" : "ghost"}
            aria-pressed={filters.section === value}
            onPress={() => filters.chooseSection(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <input
        aria-label="搜索素材"
        className="h-8 min-w-36 flex-1 rounded-md border bg-background px-2 text-sm"
        placeholder="搜索名称或资产 ID"
        maxLength={200}
        value={filters.search}
        disabled={!!commands.busy}
        onChange={(event) => filters.changeSearch(event.target.value)}
      />
      {!picking && (
        <select
          aria-label="素材类型"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={filters.kind}
          disabled={!!commands.busy}
          onChange={(event) => filters.changeKind(event.target.value)}
        >
          <option value="">图片和视频</option>
          <option value="image">图片</option>
          <option value="video">视频</option>
        </select>
      )}
    </div>
  );
}
