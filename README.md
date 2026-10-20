# CreativeFlow Frontend

This is the frontend for **CreativeFlow**, built with [Next.js](https://nextjs.org) (App Router), React 19, TypeScript, Tailwind CSS v4, and [shadcn/ui](https://ui.shadcn.com).

The main workspace is a node canvas for generating images and video at `/`. Saved workflows
open at `/workflow/[id]`, and platform administration lives at `/admin`.

The .NET API and infrastructure live in the separate
[CreativeFlow backend](https://github.com/233i/creativeflow-backend) repository.
Use a matching backend release: this frontend connects to `/hubs/creativeflow`, not the
old `/hubs/sol` endpoint. Repository names and checkout directory names need not match.

## Repository and release boundaries

CreativeFlow is released as two repositories with one browser-facing application boundary.
You need access to both repositories or their source archives; a GitHub 404 may mean
the repository is private.

- **Backend**: [`creativeflow-backend`](https://github.com/233i/creativeflow-backend) owns the .NET API,
  database migrations, runtime services, and deployment configuration.
- **Frontend**: [`creativeflow-frontend`](https://github.com/233i/creativeflow-frontend) owns the Next.js
  application, browser tests, and UI assets.
- The browser calls the backend through the same-origin `/api` and `/hubs` routes; provider credentials,
  database credentials, media files, and runtime state never belong in this repository.

The tracked tree contains source code, tests, lockfiles, documentation, and configuration templates only.
Local `.env.local` files, production overrides, `node_modules`, `.next`, build/test output, and generated
media are ignored and must be supplied by the deployment environment. Copy an example file and fill in
local values; never commit the resulting file or put secrets in `NEXT_PUBLIC_*` variables.

## Architecture

- **The canvas is the app.** `/` renders it full-bleed with no site chrome. Which document is
  open is resolved client-side (last opened → most recent → create), so there is no id in the
  URL and no redirect on the way in.
- **The browser never talks to a model vendor.** It posts a provider id and a prompt to the .NET
  API, which decrypts the key, calls upstream and stores the result. That keeps API keys off the
  client, sidesteps CORS, and works with providers that allow-list egress IPs.
- **Sign-in is required.** Email/password (and optional GitHub OAuth) creates an opaque account
  session. The device handshake runs only after authentication and scopes account data to an
  explicitly linked browser. See the
  [backend authentication guide](https://github.com/233i/creativeflow-backend/blob/main/docs/authentication.md).
- Feature code lives under `features/<domain>`; shared primitives under `components/ui` and
  `components/layout`. `features/canvas` owns the graph, `features/ai` the provider config,
  `features/settings` the settings dialog.
- Feature API modules declare endpoints and domain errors; `lib/api-client.ts` owns shared
  JSON transport, session cookies, header merging, and error-body validation. Keep message
  priority and error codes in the feature adapters. Multipart requests must let the browser
  supply their content type; asset uploads retain their separate cancellation contract.
- Keep state orchestration, pure transformations, and message rendering separate. For example,
  `features/agent/agent-panel.tsx` coordinates the panel, `conversation.ts` groups stored and
  live messages, and `conversation-messages.tsx` renders them. Preserve public exports when
  moving internal code.
- API calls run from the browser against the Next.js rewrite (`/api/*` → the .NET API) so the
  device cookie stays first-party. See `next.config.ts` for why that rewrite exists.

The API surface is documented in the
[backend API guide](https://github.com/233i/creativeflow-backend/blob/main/docs/ai-canvas-api.md).

## Getting Started

1. Follow the backend README to start its **independent local** API, database,
   Redis, RabbitMQ, and persistent file store. Check `http://localhost:5298/health/ready`.
   The current source project is `src/CreativeFlow.Api`; do not use old `src/Sol.Api`
   commands or a shared development database.
2. Install the Node version in `.node-version`, then run in this frontend checkout:

```bash
npm ci
cp .env.example .env.development.local
npm run dev
```

The template uses `API_BASE_URL=http://localhost:5298`,
`SOL_API_ORIGIN=http://localhost:5298`, and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
Adjust both API addresses if its port differs. Set the backend `Authentication:PublicOrigin`
to `http://localhost:3000` (Compose: `PUBLIC_ORIGIN`), then recreate/restart the API.
Preserve existing local files; shell environment and `.env.development.local` take priority
over `.env.local` during development. Do not copy development configuration into production.

3. Open `http://localhost:3000/admin` and sign in with the backend bootstrap admin,
   then change its initial password. Import the backend's `docs/examples/startup-echo.workflow.json`
   from the workflow center; run with `message` set to `Hello CreativeFlow`. Both nodes
   should finish and `result` should match. No model/provider is needed for this check.
4. Open `/`, register a disposable ordinary user (separate from the admin account),
   upload an image to a canvas, refresh, and confirm it remains in the asset library.
   Restart the API without deleting its volumes and verify saved results and files again.

Use `localhost` consistently in the browser so session cookies remain on one host.
`/api` and `/hubs` are proxied, but `/health` and `/swagger` are not; open those on the
API port. `curl -fsS http://localhost:3000/api/v1/system/info` should identify `creativeflow-api`.

Register or sign in first. An administrator configures providers and models at `/admin` before
users generate content; the ordinary settings dialog does not expose provider administration.

## Environments

- `.env.example` contains isolated local development addresses; `.env.production.example`
  contains placeholders for your own deployment. No shared server is required.
- For production-mode UI verification, build and start the standalone output as shown
  below. Keep an HTTP-only local backend in Development; Production API
  authentication requires HTTPS because its session cookies are Secure.
- `NEXT_PUBLIC_SITE_URL` and `SOL_API_ORIGIN` must be passed when building the production image.
  Setting only runtime environment variables does not update Next.js rewrites or public bundles.
- `.dockerignore` excludes all private `.env*` files. Supply public build arguments explicitly and
  inject runtime API configuration through the deployment environment; never put secrets into `NEXT_PUBLIC_*`.

See the [backend configuration guide](https://github.com/233i/creativeflow-backend/blob/main/docs/configuration.md) for exact values,
backend precedence, persistent volumes, and the separation between development and production.

This project sets `output: "standalone"`; `next start` emits a warning for this mode.
After stopping the dev server, verify the real production output with:

```bash
API_BASE_URL=http://localhost:5298 SOL_API_ORIGIN=http://localhost:5298 \
  NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
cp -R public .next/standalone/
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

The Dockerfile already performs the public/static copies. Reverse-proxy `/api` and
`/hubs` on the same origin and support WebSocket upgrades and unbuffered SSE for deployment.

## Testing

```bash
npm run check      # Formatting, lint, boundaries, complexity, type-check, and Vitest
npm run verify     # The same check gate plus a production build
npm run test       # Vitest — canvas graph logic, sync conflicts, config parsing
npm run test:e2e    # Playwright — requires a test API; defaults to :5298 in Development
```

Known quality-gate limitation: `check:boundaries` currently reports a pre-existing
cross-feature import from `features/workflow/nodes/workflow-nodes.tsx` to
`features/canvas/nodes/model-picker.tsx`. Type-checks, unit tests and the production
build can pass while `npm run verify` still fails this gate. Do not suppress the
check or describe the complete verification gate as passing until that boundary is fixed.

Changes to shared API transport should cover request headers, multipart uploads, empty and
malformed responses, and the feature error contracts. Changes to conversation transforms
should cover persisted/live event overlap and message order. Run `npm run build` before
shipping to verify production compilation as well.

Playwright runs serially: every spec drives the same API and database, so concurrency produces
contention rather than coverage.

See the [maintenance guide](docs/frontend-maintenance.md) for node, API, and form changes,
browser environment variables, production-mode checks, and CI setup. `.node-version` pins the
verification runtime. Browser preflight checks both the API and the frontend proxy before creating
test accounts. Reports and failure traces stay under `output/playwright/e2e/`.

## Code formatting

Use the exact Prettier version installed by this project. `.prettierrc.json` defines a
100-column target, two-space indentation, double quotes, semicolons, and LF line endings.
Long strings and comments can exceed the target width. `.editorconfig` applies the same
basic whitespace conventions in editors.

```bash
npm run format        # Format source, tests, configuration, and documentation
npm run format:check  # Check formatting without changing files
```

`.prettierignore` excludes dependencies, generated files, lockfiles, static media,
copied provider icons, local environment configuration, and browser/test output.
Keep formatting-only changes separate from behavior changes. Changes to the formatter
dependency must update both `package-lock.json` and `bun.lock`: local checks use npm,
while the Docker build uses Bun with a frozen lockfile.

`.git-blame-ignore-revs` can record future formatting-only commits in this public
history. It intentionally contains no hashes from the private development history.
To use the list without changing your Git configuration:

```bash
git -c blame.ignoreRevsFile=.git-blame-ignore-revs blame features/admin/asset-center/panel.tsx
```

See the [maintenance guide](docs/frontend-maintenance.md) for module boundaries,
verification expectations, and test-environment setup.

## Other scripts

```bash
npm run lint      # ESLint
npm run typecheck # Type-check
npm run check:boundaries # Feature entries, domain dependencies, and runtime cycles
npm run check:complexity # No new complexity violations or obsolete legacy exceptions
npm run build     # Production build
```

## License and attribution

CreativeFlow is derived from [AIDotNet/Sol](https://github.com/AIDotNet/Sol),
including its browser application. The upstream MIT license and original
`Copyright (c) 2026 AIDotNet` notice are preserved in [LICENSE](LICENSE).
This attribution does not imply upstream maintenance or endorsement of CreativeFlow.
Third-party dependencies and provider marks retain their own licenses and rights.
