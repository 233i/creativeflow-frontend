import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx,mjs}"],
    exclude: ["node_modules", ".next", "e2e"],
    env: {
      API_BASE_URL: "http://localhost:5298",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js 通过自身 webpack 配置把会抛错的 `server-only` 包别名为无操作实现；
      // Vitest 没有对应机制，因此在此做同样处理。
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
});
