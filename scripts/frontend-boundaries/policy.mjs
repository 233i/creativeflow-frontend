import { cycleEdges, dependencyGraph, moduleImports } from "./graph.mjs";
import { cycleExceptions, featureEntries } from "./config.mjs";

const publicEntries = new Set(
  Object.entries(featureEntries).flatMap(([feature, entries]) =>
    entries.map((entry) => `features/${feature}/${entry}`),
  ),
);
const withoutExtension = (file) => file.replace(/\.(tsx?|m?js)$/, "");
const isDomain = (file) => file.includes("/domain/");
const isPage = (file) => file.startsWith("app/") || /(?:^|\/)(?:page|[^/]+-page)\.tsx$/.test(file);
const isRuntimeUi = (file) =>
  /\.(tsx)$/.test(file) || /(?:^|\/)(?:[^/]*-)?(?:store|api|api-client)(?:\/|\.)/.test(file);
const frameworkRuntime =
  /^(?:react(?:\/|$)|react-dom(?:\/|$)|@xyflow\/react|zustand(?:\/|$)|next(?:\/|$))/;

export function boundaryViolations(sources) {
  const declared = dependencyGraph(sources);
  const runtime = dependencyGraph(sources, true);
  const failures = [];
  for (const [from, targets] of declared) {
    for (const to of targets) {
      if (/^(lib|components)\//.test(from) && isPage(to))
        failures.push(`共享模块不能引用页面: ${from} -> ${to}`);
      if (
        from.startsWith("features/") &&
        to.startsWith("features/") &&
        from.split("/")[1] !== to.split("/")[1] &&
        !publicEntries.has(withoutExtension(to))
      ) {
        failures.push(`跨功能调用需要显式入口: ${from} -> ${to}`);
      }
      if (isDomain(from) && isRuntimeUi(to))
        failures.push(`领域类型不能依赖 UI/store/API: ${from} -> ${to}`);
    }
    if (!isDomain(from)) continue;
    const visited = new Set();
    function visit(file) {
      if (visited.has(file)) return;
      visited.add(file);
      if (file !== from && isRuntimeUi(file))
        failures.push(`领域规则间接加载 UI/store/API: ${from} -> ${file}`);
      for (const external of moduleImports(sources.get(file) ?? "", file, true)) {
        if (frameworkRuntime.test(external))
          failures.push(`领域规则加载框架运行时: ${from} -> ${file} -> ${external}`);
      }
      for (const target of runtime.get(file) ?? []) visit(target);
    }
    visit(from);
  }
  const cycles = cycleEdges(runtime);
  const allowed = new Set(cycleExceptions.map((entry) => entry.edge));
  for (const edge of cycles) if (!allowed.has(edge)) failures.push(`运行时循环依赖: ${edge}`);
  for (const exception of cycleExceptions) {
    if (!exception.reason || !cycles.includes(exception.edge))
      failures.push(`无理由或已失效的循环例外: ${exception.edge}`);
  }
  return [...new Set(failures)].sort();
}
