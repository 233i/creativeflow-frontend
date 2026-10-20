import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { complexityViolations } from "./frontend-complexity/policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { entries } = JSON.parse(
  fs.readFileSync(path.join(root, "docs/frontend-complexity-exceptions.json"), "utf8"),
);
const eslint = new ESLint({
  cwd: root,
  overrideConfig: { rules: { complexity: ["error", 15], "max-depth": ["error", 4] } },
});
const results = await eslint.lintFiles(["app", "components", "features", "lib"]);
const findings = results
  .filter((result) => !/\.(test|spec)\./.test(result.filePath))
  .flatMap((result) =>
    result.messages
      .filter((message) => ["complexity", "max-depth"].includes(message.ruleId))
      .map((message) => ({
        file: path.relative(root, result.filePath).split(path.sep).join("/"),
        rule: message.ruleId,
        message: message.message,
      })),
  );
const failures = complexityViolations(findings, entries);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else console.log(`复杂度检查通过：${findings.length} 项明确存量例外，无新增或过期例外。`);
