"use client";
import { Button } from "@/components/ui/button";
import { KnowledgeLibraryCard } from "@/features/knowledge/components/knowledge-library-card";
import { KnowledgeEmpty } from "@/features/knowledge/knowledge-ui";
import styles from "@/features/knowledge/knowledge.module.css";
import type { ReactNode } from "react";
import type { KnowledgePanelController } from "../controllers/use-knowledge-list";
export function KnowledgeLibraryOverview({
  controller,
  createButton,
}: {
  controller: KnowledgePanelController;
  createButton: ReactNode;
}) {
  const { libraries, setQuery, setFilter, filtered } = controller;
  return (
    <div className={styles.overview}>
      <div>
        {filtered.length === 0 ? (
          <div className={styles.card}>
            <KnowledgeEmpty
              title={libraries.length ? "没有匹配的知识库" : "建立你的第一份知识"}
              action={
                libraries.length ? (
                  <Button
                    variant="outline"
                    onPress={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                  >
                    清空筛选
                  </Button>
                ) : (
                  createButton
                )
              }
            >
              {libraries.length
                ? "换个关键词，或查看全部知识库。"
                : "从产品手册、操作指南开始。创建知识库后，再导入文档并测试检索效果。"}
            </KnowledgeEmpty>
          </div>
        ) : (
          <nav aria-label="知识库列表" className={styles.libraries}>
            {filtered.map((library) => (
              <KnowledgeLibraryCard key={library.id} controller={controller} library={library} />
            ))}
          </nav>
        )}
      </div>
      <aside className={styles.guide}>
        <h3>从文档到可检索的知识</h3>
        <ol>
          <li>
            <div>
              <b>整理资料</b>
              <p>创建知识库，选择固定的向量模型。</p>
            </div>
          </li>
          <li>
            <div>
              <b>预览并入库</b>
              <p>检查分段，确认后再排队向量化。</p>
            </div>
          </li>
          <li>
            <div>
              <b>激活与测试</b>
              <p>让就绪版本生效，再查看检索命中。</p>
            </div>
          </li>
        </ol>
      </aside>
    </div>
  );
}
