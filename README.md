# CreativeFlow Frontend

The browser application for CreativeFlow: AI canvas, media workflows, general
orchestration and platform administration.
Built with Next.js App Router, React, TypeScript, Tailwind CSS, TDesign and
shared UI primitives.

[Documentation / 文档导航](docs/README.md) ·
[Backend repository](https://github.com/233i/creativeflow-backend)

## What this repository runs

| Route              | Purpose                                                            |
| ------------------ | ------------------------------------------------------------------ |
| `/`                | User canvas, media generation and assets                           |
| `/workflow/[id]`   | User workflow editor                                               |
| `/admin`           | Administration                                                     |
| `/admin/workflows` | Unified workflow center, with separate media/orchestration editors |
| `/admin/runs`      | Run center                                                         |

This is **not a standalone backend**. The .NET API handles authentication,
model calls, queues, knowledge, file storage and database migrations.
Provider keys belong on the backend, never in browser code or `NEXT_PUBLIC_*`.

## Local startup

1. Start the independent local backend using its
   [quick start](https://github.com/233i/creativeflow-backend/blob/main/README.zh-CN.md).
   Confirm `http://localhost:5298/health/ready` is healthy.
2. Install the Node version in [.node-version](.node-version), then:

```bash
git clone https://github.com/233i/creativeflow-frontend.git
cd creativeflow-frontend
npm ci
cp .env.example .env.development.local
npm run dev
```

The example targets the local API on port 5298 and the frontend on port 3000.
Set the backend `Authentication:PublicOrigin` to `http://localhost:3000`
(Compose variable: `PUBLIC_ORIGIN`) and recreate/restart the API if changed.

3. Open [the admin UI](http://localhost:3000/admin), use the backend bootstrap
   administrator and change its initial password.
4. Import the backend's `docs/examples/startup-echo.workflow.json` in the workflow
   center. `message = Hello CreativeFlow` should return the same `result`
   without a model call.
5. Open `/` and register an ordinary user for the canvas. This is separate from
   the administrator account. Configure providers/models in the admin UI before generating.

See [local development](docs/local-development.md) for environment precedence,
upload/restart acceptance and troubleshooting. `/api` and `/hubs/creativeflow`
use the same browser origin; `/health` and `/swagger` are accessed on the API port.

## Deploy or contribute

| Task                                  | Guide                                                                                                                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build/run standalone output or Docker | [Deployment](docs/deployment.md)                                                                                                                                                                |
| Change nodes, API adapters or forms   | [Maintenance](docs/frontend-maintenance.md)                                                                                                                                                     |
| Understand server contracts           | [Backend documentation](https://github.com/233i/creativeflow-backend/blob/main/docs/README.md)                                                                                                  |
| Integrate published workflows         | [REST/SSE](https://github.com/233i/creativeflow-backend/blob/main/docs/workflow-api-streaming.md) or [AG-UI](https://github.com/233i/creativeflow-backend/blob/main/docs/ag-ui-workflow-api.md) |

```bash
npm run check       # Formatting, lint, boundaries, complexity, types, unit tests
npm run verify      # check + production build
npm run test:e2e    # Browser tests; needs an isolated test API
```

These commands are quality gates, not a claim that they currently all pass.
Known formatting/boundary failures and browser prerequisites are documented in
[maintenance](docs/frontend-maintenance.md#已知检查限制).
Keep both npm and Bun lockfiles in sync when changing dependencies: local
verification uses npm, the Dockerfile uses Bun.

## Security and license

Keep local environments, uploads, traces, dependencies and build outputs out of Git.
Production requires HTTPS and a same-origin proxy with WebSocket and unbuffered SSE support.

CreativeFlow is derived from [AIDotNet/Sol](https://github.com/AIDotNet/Sol),
including its browser application. The upstream MIT license and original
`Copyright (c) 2026 AIDotNet` notice are preserved in [LICENSE](LICENSE).
This attribution does not imply upstream maintenance or endorsement.
Third-party dependencies and provider marks retain their own rights.
