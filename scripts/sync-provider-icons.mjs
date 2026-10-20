/**
 * 将使用的供应商徽标从 @lobehub/icons-static-svg 复制到 public/。
 *
 * 该包包含约 1000 个原始 .svg 文件。Next.js 没有加载器时无法把 .svg 作为组件导入，
 * 我们也不希望把完整集合打进包中，因此只把引用的少量文件复制到 public/provider-icons/，
 * 并作为普通图片提供。
 *
 * 添加使用新 iconSlug 的预设后运行：node scripts/sync-provider-icons.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "node_modules", "@lobehub", "icons-static-svg", "icons");
const target = join(here, "..", "public", "provider-icons");

/** features/ai/presets 和 detectModelIconSlug 引用的短名。 */
const SLUGS = [
  "openai",
  "claude",
  "gemini",
  "doubao",
  "siliconcloud",
  "grok",
  "openrouter",
  "deepseek",
  "ollama",
  "qwen",
  "zhipu",
  "minimax",
  "moonshot",
  "azure",
  "meta",
  "mistral",
];

if (!existsSync(source)) {
  console.error(`Icon package not found at ${source} — run npm install first.`);
  process.exit(1);
}

const available = new Set(readdirSync(source));

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const copied = [];
const missing = [];

for (const slug of SLUGS) {
  // 优先使用品牌彩色变体；部分短名只提供单色文件。
  const file = available.has(`${slug}-color.svg`) ? `${slug}-color.svg` : `${slug}.svg`;

  if (!available.has(file)) {
    missing.push(slug);
    continue;
  }

  copyFileSync(join(source, file), join(target, `${slug}.svg`));
  copied.push(slug);
}

console.log(`Copied ${copied.length} provider icons to public/provider-icons/`);
if (missing.length > 0) {
  console.warn(`No icon found for: ${missing.join(", ")}`);
}
