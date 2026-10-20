"use client";
import styles from "@/features/knowledge/knowledge.module.css";
import { Search } from "lucide-react";
import type { KnowledgePanelController } from "../controllers/use-knowledge-list";
export function KnowledgeListToolbar({ controller }: { controller: KnowledgePanelController }) {
  const { libraries, query, setQuery, filter, setFilter, activeCount, inactiveCount } = controller;
  return (
    <div className={styles.toolbar}>
      <div className={styles.filters} aria-label="知识库状态筛选">
        {[
          { id: "all", label: "全部", count: libraries.length },
          { id: "active", label: "可检索", count: activeCount },
          { id: "disabled", label: "已停用", count: inactiveCount },
        ].map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{item.count}</span>
          </button>
        ))}
      </div>
      <div className={styles.search}>
        <Search size={15} aria-hidden />
        <input
          aria-label="搜索知识库"
          placeholder="搜索名称或用途说明"
          className={styles.control}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
    </div>
  );
}
