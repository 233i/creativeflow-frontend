import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundaryViolations } from "./frontend-boundaries/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = new Map();
function collect(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (/\.[cm]?[jt]sx?$/.test(file) && !/\.(test|spec|d)\./.test(file)) {
      sources.set(file, fs.readFileSync(path.join(root, file), "utf8"));
    }
  }
}
for (const directory of ["app", "components", "features", "lib"]) collect(directory);
const failures = boundaryViolations(sources);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`模块边界通过：${sources.size} 个源码模块，无新增运行时环。`);
