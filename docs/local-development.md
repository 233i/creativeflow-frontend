# 本地开发与联调

以下命令在前端仓库根目录执行。后端先按其
[快速启动](https://github.com/233i/creativeflow-backend/blob/main/README.zh-CN.md)
启动独立本地环境，不连接正式数据库或模型。

## 安装和启动

安装 [.node-version](../.node-version) 指定的 Node。首次运行：

```bash
npm ci
cp .env.example .env.development.local
npm run dev
```

已有私有配置时先检查，不要直接覆盖。`npm ci` 使用 `package-lock.json`。
前端端口默认 3000，浏览器使用 `http://localhost:3000`。

## 环境变量

| 变量                   | 本地值                  | 说明                                                  |
| ---------------------- | ----------------------- | ----------------------------------------------------- |
| `SOL_API_ORIGIN`       | `http://localhost:5298` | `next.config.ts` 中 `/api`、`/hubs` rewrite 的目标    |
| `API_BASE_URL`         | `http://localhost:5298` | 应用环境校验要求的 API 地址；与 rewrite 目标保持一致  |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 浏览器公开站点地址、metadata/sitemap 使用，不得存秘密 |

变量名中的 `SOL_` 是当前代码的配置键，不要自行改名。
开发环境优先级：进程环境 → `.env.development.local` → `.env.local` →
`.env.development` → `.env`。修改后重启开发服务。
生产构建的 rewrite 和公开值会固化到产物，见[部署说明](deployment.md)。

后端 `Authentication:PublicOrigin` 设为 `http://localhost:3000`；
使用后端 Compose 时设置 `PUBLIC_ORIGIN`，再重新创建 API 容器。
API 更换端口时同时更新前端两个 API 地址。
不要在浏览器登录过程中混用 `localhost` 与 `127.0.0.1`，Cookie 属于不同主机。

## 确认访问了正确后端

在服务运行后另开终端：

```bash
curl -fsS http://localhost:5298/health/ready
curl -fsS http://localhost:3000/api/v1/system/info
```

第二个响应应标识 `creativeflow-api`，本机默认环境为 `Development`。
前端只代理 `/api` 和 `/hubs`；Swagger 和健康检查用后端 5298 端口。
如果响应来自其他环境，先检查 shell 环境及 `.env*.local`，不要继续提交测试数据。

## 不调用模型的验收

1. `/admin`：用后端引导管理员登录并修改初始密码。
2. 工作流中心导入后端
   [`startup-echo.workflow.json`](https://github.com/233i/creativeflow-backend/blob/main/docs/examples/startup-echo.workflow.json)，
   输入 `message = Hello CreativeFlow`，两个节点完成且 `result` 相同。
3. `/`：注册一个普通测试账号；管理员不是普通用户。上传小图片，在素材库选择同一素材，
   保存画布并刷新，确认连线与素材仍在。
4. 仅重启自己启动的后端，不删除数据卷。重新查询运行历史并下载图片，确认数据仍在。
5. 需要真实生成时，再由管理员配置渠道、模型和用途，按后端说明配置端点许可。
   模型测试可能收费，不属于上述无费用验收。

知识库需要 Qdrant 和向量模型，脚本需要 OpenSandbox；这些服务健康不由 Next.js 构建证明。
实际权限与限制见[后端文档](https://github.com/233i/creativeflow-backend/blob/main/docs/README.md)。

## 常见问题

| 现象                  | 优先检查                                                                      |
| --------------------- | ----------------------------------------------------------------------------- |
| `/api` 502 或无法连接 | API 是否启动、`SOL_API_ORIGIN`、是否仍在用旧构建                              |
| 登录后又回到登录页    | 用户/管理员入口是否混用、Cookie 主机、Production 后端是否通过 HTTPS           |
| 后台可进入但生成失败  | 渠道 Key、启用模型/用途、后端网络许可，不是前端能决定的权限                   |
| 界面状态不更新        | `/hubs/creativeflow` 连接与回退传输；通过 HTTP 查询核对真实运行               |
| SSE 最后才显示        | 代理缓冲、客户端分帧处理、运行是否提交了文本流；自定义 SSE 不保证逐个节点事件 |
| 前端启动但没有资料    | 当前登录账号/设备范围、API 是否指向预期实例，不要直接修改数据库归属           |

测试和浏览器自动化使用独立环境，见[维护说明](frontend-maintenance.md)。
