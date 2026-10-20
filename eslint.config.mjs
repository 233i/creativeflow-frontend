import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "features/workflow/v2/domain/**/*.{ts,tsx}",
      "features/workflow/v2/node-configurations.tsx",
      "features/workflow/controllers/**/*.{ts,tsx}",
      "features/workflow/components/**/*.{ts,tsx}",
      "features/workflow/v2/controllers/**/*.{ts,tsx}",
      "features/workflow/v2/components/**/*.{ts,tsx}",
      "features/workflow/workflow-page.tsx",
      "features/workflow/v2/editor.tsx",
      "features/workflow/editor-session.tsx",
      "features/admin/asset-center/**/*.{ts,tsx}",
      "features/canvas/asset-library/**/*.{ts,tsx}",
      "features/canvas/asset-library-dialog.tsx",
      "features/assets/controllers/**/*.{ts,tsx}",
      "features/assets/{api,commands,presentation}.ts",
      "lib/hooks/**/*.{ts,tsx}",
      "features/canvas/{components,controllers}/**/*.{ts,tsx}",
      "features/canvas/canvas-page.tsx",
      "features/canvas/drag-history.ts",
      "features/agent/{components,controllers}/**/*.{ts,tsx}",
      "features/agent/{agent-panel,model-options,presentation}.{ts,tsx}",
      "features/workflow/external-api/{components,controllers}/**/*.{ts,tsx}",
      "features/workflow/external-api/{publish-panel,publication-types,publication-errors}.{ts,tsx}",
      "features/workflow/presentation/**/*.{ts,tsx}",
      "features/workflow/{editor-assets,editor-environment}.{ts,tsx}",
      "features/admin/workflow-center/{components,controllers}/**/*.{ts,tsx}",
      "features/admin/workflow-center/{panel,detail-page,detail-location,detail-types}.{ts,tsx}",
      "features/knowledge/{components,controllers}/**/*.{ts,tsx}",
      "features/knowledge/{knowledge-panel,knowledge-detail,import-panel,documents-panel,versions-panel,permissions-panel,key-permissions}.tsx",
      "features/knowledge/version-selection.ts",
      "features/http-requests/{components,controllers}/**/*.{ts,tsx}",
      "features/http-requests/{credential-manager,credential-access,credential-form,credential-access-styles}.{ts,tsx}",
      "features/settings/{models,providers}/**/*.{ts,tsx}",
      "features/settings/panels/{provider-panel,model-form-dialog,embedding-model-dialog}.tsx",
    ],
    rules: { complexity: ["error", 15], "max-depth": ["error", 4] },
  },
  // 覆盖 eslint-config-next 的默认忽略项。
  globalIgnores([
    // eslint-config-next 的默认忽略项：
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "output/playwright/**",
    ".playwright-cli/**",
  ]),
]);

export default eslintConfig;
