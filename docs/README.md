# 前端文档导航

项目首页：[简体中文](../README.zh-CN.md) · [English](../README.md)。

前端负责网页交互；鉴权、模型调用、队列、知识索引、文件和数据库由
[后端](https://github.com/233i/creativeflow-backend)负责。
不要把启动 Next.js 当作启动完整系统。

| 任务                                 | 文档                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| 首次启动                             | [根 README](../README.md)                                                         |
| 配置本机地址、登录并验证前后端       | [本地开发](local-development.md)                                                  |
| 生产构建、Docker、HTTPS 与流式代理   | [部署](deployment.md)                                                             |
| 修改节点/API/管理表单，执行测试与 CI | [维护说明](frontend-maintenance.md)                                               |
| 查接口、配置与后端约束               | [后端文档](https://github.com/233i/creativeflow-backend/blob/main/docs/README.md) |

## 保留的非文档文件

[`frontend-complexity-exceptions.json`](frontend-complexity-exceptions.json) 是
`npm run check:complexity` 使用的存量检查输入，不是普通报告；不能为消除报错随意删改。
不再保留未被检查脚本使用的历史统计和阶段性治理计划。

## 文档维护规则

- README 只保留产品边界、启动和导航；详细步骤放到对应专题。
- 后端接口语义链接后端文档，不在前端复制一整套易过期的 API 表。
- 示例仅用本机或保留示例域名，不保存服务器地址、账号、密钥、验收截图或内部部署日志。
- 改环境变量、构建方式、路由或脚本时，同步改对应说明，并验证相对链接。
- 文档描述的是当前行为；已知失败不能写成“全部通过”，未启用功能不能写成默认可用。
