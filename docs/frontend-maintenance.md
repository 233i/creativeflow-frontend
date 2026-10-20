# 前端维护说明

适用范围：CreativeFlow 前端。路径均相对本仓库根目录。

## 检查入口

```bash
npm ci
npm run verify
git diff --check
```

Node 版本见 `.node-version`。`verify` 顺序执行 `check` 和生产构建；`check` 包含格式、零警告 lint、依赖边界、复杂度存量检查、类型检查和全部 Vitest。依赖变更同时更新 npm 与 Bun 锁文件，不能只改其中一个。浏览器检查另需专用后端，不能把构建通过当成交互通过。

新增逻辑函数默认复杂度不超过 15、嵌套不超过 4。已治理目录直接由 ESLint 拦截；全库另有 `check:complexity`：[存量清单](frontend-complexity-exceptions.json)精确记录诊断、数量、保留原因和后续归属。新函数、复杂度增加、例外过期均失败。修复旧函数后删除对应例外；不要给新实现追加例外或批量重生成清单。

文件超过 400 行、组件超过 200 行时人工复查职责；静态注册表和字典单独评估。类型检查也拒绝未使用的局部声明和参数。跨功能入口集中在 `scripts/frontend-boundaries/config.mjs`，新增入口需要说明调用方和职责，不开放整个目录；领域模块不能直接或间接加载 UI、store、API 或框架运行时。运行时循环依赖当前没有例外。

## 新增通用工作流节点

1. 在 `features/workflow/v2/domain/nodes.ts` 定义节点种类及其配置类型，在 `domain/node-definitions.ts` 的完整映射中添加默认值、字段、端口、分组及能力。领域注册表不导入 React 或图标。
2. 在 `domain/node-validation.ts` 补充来自文件/API 的运行时配置校验。导入入口 `domain/import-graph.ts` 接受 `unknown`；不要用类型断言代替验证。连线继续复用 `domain/connections.ts`，持久化继续走 `domain/snapshot.ts`。
3. 在 `node-configurations.tsx` 添加配置视图，在 `node-icons.ts` 添加图标，并检查 `node-card.tsx` 和 `components/editor-canvas.tsx` 的渲染映射。保留明确的公共导出边界；目录名称 v2 不等于持久化版本，当前 `schemaVersion` 仍为 1。
4. 与后端同步执行、导入、发布及历史快照契约；新增节点不能只完成配置界面。

必需测试：默认值和固定端口（`domain/node-contracts.test.ts`）、非法/旧图导入（`domain/import-graph.test.ts`）、创建与清理连接的一致性（`domain/connections.test.ts`）、执行输入（`types.test.ts`），以及相应配置/执行 UI 测试。覆盖空可选值、默认值、字段删除改名、控制端口、重复连接和环。

```bash
npm test -- features/workflow/v2
npm run verify
```

浏览器实际添加节点、配置字段、连线、保存重载、导出再导入、执行并读取历史；确认请求不带 React Flow 的选择和测量状态。涉及局部重跑时验证使用原运行快照。

## 修改 API 适配

传输位于 `lib/api-client.ts`；具体 URL、DTO、错误码和业务错误优先级留在功能的 `api.ts` 或专用适配器。参考 `features/assets/api.ts`、`features/workflow/api.ts`、`features/workflow/external-api/api.ts` 与 `features/http-requests/credentials-api.ts`。不要把请求搬进展示组件，也不要让领域规则依赖网络客户端。

修改时保留 Cookie、合并后的请求头、空响应和异常响应处理。Multipart 不手写 Content-Type，上传保留 AbortSignal；密钥明文只存在于输入或一次性签发结果。请求取消、业务拒绝和状态不明确分别处理，查询恢复不能再次创建任务。

必需测试：共享传输改动运行 `lib/api-client.test.ts` 和受影响适配器测试；控制器改动覆盖乱序响应、切换文档、卸载、重复操作互斥、401/403/404 清理、失败草稿保留。运行创建参考 `controllers/use-run-creation.test.tsx`，不能只断言 mock 被调用。

```bash
npm test -- lib/api-client.test.ts features/api-contracts.test.ts
npm test -- features/workflow/controllers features/workflow/v2/controllers
npm run verify
```

浏览器至少验证成功、失败恢复、权限失效以及刷新后的持久状态。发布 API 要额外检查已发布版本固定、Key 吊销、历史读取和 SSE 断线重连；前端 mock 验收与真实后端验收分别记录。

## 新增管理表单

页面入口组装功能控制器和展示组件。可参考 `features/http-requests/controllers/use-credential-manager.ts`、`features/settings/providers/use-provider-commands.ts` 及各自 `components/`。表单草稿、读取生命周期、写命令和展示各有归属；权限由管理容器提供，功能组件通过显式接口使用。

提交要有同步互斥，失败保留输入并显示可见错误；成功后清理敏感字段，刷新只读数据。切换记录和卸载使旧响应失效，权限失效时清理旧内容。与其他页签共用的工作流草稿通过 `features/workflow/editor-session.tsx` 交接，不复制离开提醒或保存状态。

必需测试覆盖：旧配置回填、必填/格式约束、快速重复点击只提交一次、失败可重试、失败保留输入、成功清空密钥、切换记录不被迟到响应覆盖，以及权限变化。参考 `use-credential-manager.test.ts`、`use-provider-detail.test.ts` 和工作流详情测试。

浏览器检查标签和键盘焦点、弹窗关闭、错误提示、切换后回填及重新加载。只新增局部展示时复用现有行为测试；不要为文件拆分写源码字符串或内部布局断言。

## 跨服务浏览器检查

`npm run test:e2e` 运行 `e2e/` 下的画布与权限回归，单 worker。需要专用测试账户可注册、文件存储可写的后端；测试会创建合成账户和素材，后端环境负责清理专用数据库。运行前 `e2e/global-setup.ts` 分别核验 API 直连与 Next 代理的服务名和环境；目标不一致或为 Production 时，在创建账户之前失败。

| 变量                           | 默认值                  | 用途                                                               |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------ |
| `SOL_API_ORIGIN`               | `http://localhost:5298` | 前端 rewrite 的后端，构建时也必须设置                              |
| `API_BASE_URL`                 | 必填，无默认值          | 应用环境校验，与测试 API 保持一致                                  |
| `SOL_E2E_BASE_URL`             | `http://localhost:3000` | 浏览器访问的前端源                                                 |
| `SOL_E2E_EXPECTED_ENVIRONMENT` | `Development`           | 精确匹配后端环境；仅接受 Development、MigrationBaseline、Testing   |
| `SOL_E2E_SERVER`               | 本地 dev；CI production | dev 启动开发服务；production 启动已有构建；external 使用已运行前端 |
| `SOL_E2E_CHANNEL`              | Playwright Chromium     | 本机可设为 msedge 或 chrome                                        |

常规测试可按[本地开发](local-development.md)启动独立 Development 后端。
后端另有[专用验收环境](https://github.com/233i/creativeflow-backend/blob/main/tests/maf-e2e/README.md)，其启动器依赖 macOS arm64 和指定本地运行时缓存，不是通用安装脚本。使用该环境时，先启动其独立基础服务、API 和模型替身，然后在同一终端运行：

```bash
export SOL_API_ORIGIN=http://127.0.0.1:55443
export API_BASE_URL=http://127.0.0.1:55443
export NEXT_PUBLIC_SITE_URL=http://127.0.0.1:55444
export SOL_E2E_BASE_URL=http://127.0.0.1:55444
export SOL_E2E_EXPECTED_ENVIRONMENT=MigrationBaseline
export SOL_E2E_SERVER=production
npm run verify
npx playwright install chromium
npm run test:e2e
```

`production` 模式不复用已有端口，套件通过 `npm start` 启动已有构建；这是当前测试入口，不等同于推荐的 standalone 部署。验证实际 standalone 产物时，按[部署说明](deployment.md)启动它，设置 `SOL_E2E_SERVER=external`，测试不会代为关闭外部进程。报告、失败截图和 trace 位于 `output/playwright/e2e/`。CI 重试后通过仍按 flaky 失败，不能掩盖首轮问题。已有画布测试不代表所有管理功能已自动覆盖。

## CI 接入

`.github/workflows/frontend.yml` 提供 GitHub Actions 配置。作业是否通过以当前 Actions 结果为准；本地构建通过不等于所有质量门禁通过。其他平台直接调用同一套 npm 命令，不维护第二套检查逻辑。

- PR、main 推送和手动运行的 `Frontend quality and build` 作业执行 `npm ci`、`npm run verify`。需要强制门禁时，将此作业设为 main 的必需合并检查；分支保护由仓库设置负责，YAML 不能代替它。
- 跨服务作业仅在非 PR 运行且**仓库级变量** `SOL_E2E_API_ORIGIN` 已配置时启用，使用 `frontend-e2e` 环境，串行访问独立测试 API。环境变量 `SOL_E2E_EXPECTED_ENVIRONMENT` 默认 Testing，需与后端一致。不要把生产或日常共享开发数据库提供给该作业。
- 后端须能被 runner 访问。该作业用测试 API 地址重新构建前端，安装 Chromium，执行 `npm run test:e2e`，保存报告 7 天。没有后端时该作业显示 skipped，不算浏览器验收成功。

## 已知检查限制

当前源码仍有部分文件未符合 Prettier 格式，完整 `verify` 会先在 `format:check` 失败；
依赖边界检查还会报告
`features/workflow/nodes/workflow-nodes.tsx` 直接引用
`features/canvas/nodes/model-picker.tsx`。
执行结果以本地检查和 Actions 为准，不能因单独构建/单元测试通过而声称完整门禁通过。
不要关闭检查或给新问题添加豁免；修复这些问题应作为独立代码变更。

## 格式与模块约定

使用锁文件中的 Prettier 版本。`.prettierrc.json` 与 `.editorconfig` 是格式依据：
100 列目标、两空格、双引号、分号、LF。可以仅格式化改动文件：

```bash
npx prettier --write README.md docs/*.md
npm run format:check
```

`npm run format` 会格式化全库，非格式专用变更不要顺带重写无关文件。
`features/<domain>` 保存业务模块，`components/ui` 保存共享 UI，`lib/api-client.ts`
保存通用传输。TDesign 与现有 UI primitives 按页面既有体系复用，
不能因为文档列了多个组件库就随意在同一交互中混搭。
