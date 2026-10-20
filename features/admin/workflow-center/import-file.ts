import { isRecord, parseWorkflowGraph } from "@/features/workflow/graph-import";
import {
  importWorkflow,
  MAX_WORKFLOW_FILE_BYTES,
  type WorkflowImportResult,
} from "@/features/workflow/persistence";

/** 媒体格式继续走旧校验；通用格式在进入画布前检查类型、端口及资源引用结构，授权仍由服务器判定。 */
export function importCenterWorkflow(text: string): WorkflowImportResult {
  if (new TextEncoder().encode(text).length > MAX_WORKFLOW_FILE_BYTES)
    return { ok: false, detail: "文件不能超过 2 MB。" };
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, detail: "文件不是有效 JSON。" };
  }
  if (!isRecord(file) || file.schemaVersion !== 1) return importWorkflow(text);
  try {
    if (file.format !== "creativeflow-workflow" || file.formatVersion !== 1)
      throw new Error("不支持的工作流文件格式。");
    if (typeof file.name !== "string" || !file.name.trim() || file.name.length > 200)
      throw new Error("工作流名称不能为空且不能超过 200 字。");
    const graph = file.graph;
    if (!isRecord(graph) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
      throw new Error("工作流图的版本或节点结构无效。");
    // 稳定文件格式同时承载媒体画布和类型化工作流；媒体图没有图级 schemaVersion，交回原有校验器。
    if (graph.schemaVersion !== 1) return importWorkflow(text);
    return { ok: true, name: file.name.trim(), graph: parseWorkflowGraph(graph) };
  } catch (reason) {
    return { ok: false, detail: reason instanceof Error ? reason.message : "图校验失败。" };
  }
}
