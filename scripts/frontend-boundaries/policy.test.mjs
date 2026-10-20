import { describe, expect, it } from "vitest";
import { boundaryViolations } from "./policy.mjs";
import { cycleEdges, dependencyGraph } from "./graph.mjs";

const sources = (files) => new Map(Object.entries(files));
describe("frontend dependency boundaries", () => {
  it("allows structural framework types without loading the UI runtime", () => {
    expect(
      boundaryViolations(
        sources({
          "features/workflow/domain/nodes.ts":
            'import type { Node } from "@xyflow/react"; export type Graph = Node[];',
        }),
      ),
    ).toEqual([]);
  });
  it("catches a domain dependency hidden behind a re-export", () => {
    const failures = boundaryViolations(
      sources({
        "features/workflow/domain/rules.ts": 'export {getData} from "../helpers";',
        "features/workflow/helpers.ts": 'export {getData} from "./api";',
        "features/workflow/api.ts": 'export const getData=()=>fetch("/api");',
      }),
    );
    expect(failures).toContain(
      "领域规则间接加载 UI/store/API: features/workflow/domain/rules.ts -> features/workflow/api.ts",
    );
  });
  it("rejects shared page imports and private cross-feature modules but accepts public adapters", () => {
    const failures = boundaryViolations(
      sources({
        "lib/shortcut.ts": 'export {Page} from "@/features/canvas/canvas-page";',
        "features/canvas/canvas-page.tsx": "export const Page=()=>null;",
        "features/admin/controller.ts":
          'import {act} from "@/features/workflow/controllers/actions"; import {api} from "@/features/workflow/api"; export const run=()=>act(api);',
        "features/workflow/controllers/actions.ts": "export const act=x=>x;",
        "features/workflow/api.ts": "export const api={};",
      }),
    );
    expect(failures).toHaveLength(2);
    expect(failures.some((value) => value.includes("共享模块不能引用页面"))).toBe(true);
    expect(failures.some((value) => value.includes("controllers/actions"))).toBe(true);
  });
  it("allows the shared AI model picker without exposing canvas node internals", () => {
    expect(
      boundaryViolations(
        sources({
          "features/ai/model-picker.tsx": "export const ModelPicker=()=>null;",
          "features/canvas/nodes/image-gen-node.tsx":
            'import {ModelPicker} from "@/features/ai/model-picker"; export const ImageNode=ModelPicker;',
          "features/workflow/nodes/workflow-nodes.tsx":
            'import {ModelPicker} from "@/features/ai/model-picker"; import {PrivateNode} from "@/features/canvas/nodes/private-node"; export const WorkflowNode=()=>[ModelPicker,PrivateNode];',
          "features/canvas/nodes/private-node.tsx": "export const PrivateNode=()=>null;",
        }),
      ),
    ).toEqual([
      "跨功能调用需要显式入口: features/workflow/nodes/workflow-nodes.tsx -> features/canvas/nodes/private-node.tsx",
    ]);
  });
  it("finds dynamic-import cycles and all cyclic edges while ignoring type-only back references", () => {
    const graph = dependencyGraph(
      sources({
        "a.ts": 'export async function run(){return import("./b")} export type A=string;',
        "b.ts": 'export {run} from "./a"; export {extra} from "./c";',
        "c.ts": 'import type {A} from "./a"; export const extra:A="ok";',
      }),
      true,
    );
    expect(cycleEdges(graph)).toEqual(["a.ts -> b.ts", "b.ts -> a.ts"]);
  });
});
