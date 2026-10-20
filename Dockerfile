FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG API_BASE_URL=http://localhost:5298
# next.config.ts 会在构建时将其解析到 routes-manifest.json，因此它必须作为构建参数传入；
# 若只在运行环境中设置，重写规则已经来不及使用。
ARG SOL_API_ORIGIN=http://localhost:5298
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV API_BASE_URL=$API_BASE_URL
ENV SOL_API_ORIGIN=$SOL_API_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# .next/standalone 只打包追踪到的生产依赖，因此运行时镜像无需执行 node_modules/bun 安装步骤。
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
ENTRYPOINT ["bun", "server.js"]
