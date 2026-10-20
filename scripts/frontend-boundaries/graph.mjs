import path from "node:path";
import ts from "typescript";

/** 编译后的导入才参与运行时环检测，类型导入和重导出仍保留给边界检查。 */
export function moduleImports(source, file, runtime = false) {
  const code = runtime
    ? ts.transpileModule(source, {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve },
      }).outputText
    : source;
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(tree) === "require") &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...new Set(imports)];
}

export function resolveModule(from, specifier, files) {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
      : null;
  if (!base) return null;
  return (
    [
      base,
      ...[".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"].map((suffix) => base + suffix),
    ].find((candidate) => files.has(candidate)) ?? null
  );
}

/** 返回强连通分量中的每条边；既有分量内部新增的环也不能绕过检查。 */
export function cycleEdges(graph) {
  let next = 0;
  const order = new Map(),
    low = new Map(),
    stack = [],
    stacked = new Set(),
    cycles = [];
  function visit(file) {
    order.set(file, next);
    low.set(file, next++);
    stack.push(file);
    stacked.add(file);
    for (const target of graph.get(file) ?? []) {
      if (!order.has(target)) {
        visit(target);
        low.set(file, Math.min(low.get(file), low.get(target)));
      } else if (stacked.has(target)) {
        low.set(file, Math.min(low.get(file), order.get(target)));
      }
    }
    if (low.get(file) !== order.get(file)) return;
    const component = new Set();
    let member;
    do {
      member = stack.pop();
      stacked.delete(member);
      component.add(member);
    } while (member !== file);
    for (const from of component) {
      for (const to of graph.get(from) ?? []) {
        if (component.has(to) && (component.size > 1 || from === to))
          cycles.push(`${from} -> ${to}`);
      }
    }
  }
  for (const file of graph.keys()) if (!order.has(file)) visit(file);
  return cycles.sort();
}

export function dependencyGraph(sources, runtime = false) {
  const files = new Set(sources.keys());
  return new Map(
    [...sources].map(([file, source]) => [
      file,
      moduleImports(source, file, runtime)
        .map((specifier) => resolveModule(file, specifier, files))
        .filter(Boolean),
    ]),
  );
}
